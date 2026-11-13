import { Router } from 'express';
import crypto from 'node:crypto';
import { createNotification, getDb, logAudit, runTransaction } from '../db/database';
import { type AuthedRequest, getClientIp, requireAuth, requireRole } from '../middleware/auth';
import { computeFeeSummary, formatCode, formatCurrency } from '../../src/utils/eduLogic';

const router = Router();
router.use(requireAuth);

// ─── FINANCIAL DASHBOARD SUMMARY ─────────────────────────────────────────────
router.get('/summary', requireRole('admin'), (_req, res) => {
  const db = getDb();

  const totalIncome = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM income_records`).get() as { total: number }).total;
  const totalExpenses = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expense_records`).get() as { total: number }).total;
  const totalSalariesPaid = (db.prepare(`SELECT COALESCE(SUM(paid_amount), 0) AS total FROM salary_payments`).get() as { total: number }).total;
  const collectedFees = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments`).get() as { total: number }).total;
  const outstandingFees = (
    db.prepare(`SELECT COALESCE(SUM(MAX(0, total_amount - discount_amount - paid_amount)), 0) AS total FROM student_fees`).get() as { total: number }
  ).total;

  // Monthly breakdown (income vs expenses + salaries)
  const monthlyIncome = db
    .prepare(`SELECT strftime('%Y-%m', income_date) AS ym, COALESCE(SUM(amount), 0) AS total FROM income_records GROUP BY ym ORDER BY ym ASC`)
    .all() as Array<{ ym: string; total: number }>;
  const monthlyExpenses = db
    .prepare(
      `SELECT ym, SUM(total) AS total FROM (
         SELECT strftime('%Y-%m', expense_date) AS ym, amount AS total FROM expense_records
         UNION ALL
         SELECT strftime('%Y-%m', payment_date) AS ym, paid_amount AS total FROM salary_payments
       ) GROUP BY ym ORDER BY ym ASC`
    )
    .all() as Array<{ ym: string; total: number }>;

  const monthsSet = new Set<string>([...monthlyIncome.map((m) => m.ym), ...monthlyExpenses.map((m) => m.ym)]);
  const months = [...monthsSet].sort();
  const monthlyChart = months.map((ym) => ({
    month: ym,
    income: monthlyIncome.find((m) => m.ym === ym)?.total || 0,
    expenses: monthlyExpenses.find((m) => m.ym === ym)?.total || 0,
  }));

  res.json({
    total_income: totalIncome,
    total_expenses: totalExpenses,
    total_salaries_paid: totalSalariesPaid,
    net_balance: Math.round((totalIncome - totalExpenses - totalSalariesPaid) * 100) / 100,
    collected_fees: collectedFees,
    outstanding_fees: outstandingFees,
    monthly_chart: monthlyChart,
  });
});

// ─── FEE DEFINITIONS & STUDENT FEES ──────────────────────────────────────────
router.get('/fee-definitions', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(`SELECT fd.*, c.title AS course_title FROM fee_definitions fd LEFT JOIN courses c ON c.id = fd.course_id ORDER BY fd.id DESC`)
    .all();
  res.json({ feeDefinitions: rows });
});

router.post('/fee-definitions', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || Number(b.amount) <= 0) {
    res.status(400).json({ error: 'Fee title and positive amount are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO fee_definitions (title, course_id, amount, fee_type, description, is_active) VALUES (?, ?, ?, ?, ?, 1)`)
    .run(
      String(b.title).trim(),
      b.course_id ? Number(b.course_id) : null,
      Number(b.amount),
      ['tuition', 'registration', 'exam', 'material', 'other'].includes(b.fee_type) ? b.fee_type : 'tuition',
      String(b.description || '')
    );
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.get('/student-fees', requireRole('admin', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  if (user.role === 'student') {
    const fees = db.prepare(`SELECT * FROM student_fees WHERE student_id = ? ORDER BY id DESC`).all(user.student_id || 0);
    const payments = db.prepare(`SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC`).all(user.student_id || 0);
    res.json({ studentFees: fees, payments });
    return;
  }

  const fees = db
    .prepare(
      `SELECT sf.*, s.student_code, s.first_name || ' ' || s.last_name AS student_name
       FROM student_fees sf
       JOIN students s ON s.id = sf.student_id
       ORDER BY sf.id DESC`
    )
    .all();
  const payments = db
    .prepare(
      `SELECT p.*, s.student_code, s.first_name || ' ' || s.last_name AS student_name, sf.title AS fee_title
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN student_fees sf ON sf.id = p.student_fee_id
       ORDER BY p.payment_date DESC, p.id DESC`
    )
    .all();
  res.json({ studentFees: fees, payments });
});

router.post('/student-fees', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const studentId = Number(b.student_id || 0);
  const totalAmount = Number(b.total_amount || 0);
  const discountAmount = Number(b.discount_amount || 0);
  if (!studentId || !b.title || totalAmount <= 0) {
    res.status(400).json({ error: 'Student, fee title, and positive total amount are required.' });
    return;
  }
  const summary = computeFeeSummary(totalAmount, discountAmount, 0);
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO student_fees (student_id, fee_definition_id, title, total_amount, discount_amount, paid_amount, due_date, status)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(studentId, b.fee_definition_id ? Number(b.fee_definition_id) : null, String(b.title).trim(), totalAmount, discountAmount, String(b.due_date || ''), summary.status);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'STUDENT_FEE_ASSIGNED', module: 'finance', recordRef: `stu:${studentId}`, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

// ─── TRANSACTIONAL IMMUTABLE PAYMENT RECORDING ───────────────────────────────
router.post('/payments', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const studentFeeId = Number(b.student_fee_id || 0);
  const amount = Math.round(Number(b.amount || 0) * 100) / 100;
  const method = ['cash', 'bank', 'card', 'transfer'].includes(b.payment_method) ? b.payment_method : 'cash';
  const idempotencyKey = String(b.idempotency_key || crypto.randomUUID()).trim();
  const paymentDate = String(b.payment_date || new Date().toISOString().slice(0, 10));

  if (!studentFeeId || amount <= 0) {
    res.status(400).json({ error: 'Valid student fee record and positive payment amount are required.' });
    return;
  }

  try {
    const result = runTransaction((tx) => {
      const duplicate = tx.prepare(`SELECT id, receipt_number FROM payments WHERE idempotency_key = ?`).get(idempotencyKey) as
        | { id: number; receipt_number: string }
        | undefined;
      if (duplicate) {
        throw new Error(`Duplicate payment prevented (Receipt ${duplicate.receipt_number}).`);
      }

      const feeRow = tx.prepare(`SELECT * FROM student_fees WHERE id = ?`).get(studentFeeId) as any;
      if (!feeRow) throw new Error('Student fee record not found.');

      const currentSummary = computeFeeSummary(feeRow.total_amount, feeRow.discount_amount, feeRow.paid_amount);
      if (amount > currentSummary.remaining + 0.001) {
        throw new Error(`Payment amount (${formatCurrency(amount)}) exceeds remaining balance (${formatCurrency(currentSummary.remaining)}).`);
      }

      const nextPaid = Math.round((feeRow.paid_amount + amount) * 100) / 100;
      const updatedSummary = computeFeeSummary(feeRow.total_amount, feeRow.discount_amount, nextPaid);

      const nxt = (tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM payments`).get() as { nxt: number }).nxt;
      const receiptNumber = `RCP-2026-${formatCode('', nxt, 4).replace('-', '')}`;

      const payRes = tx
        .prepare(
          `INSERT INTO payments (receipt_number, student_fee_id, student_id, amount, payment_method, payment_date, idempotency_key, notes, received_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(receiptNumber, studentFeeId, feeRow.student_id, amount, method, paymentDate, idempotencyKey, String(b.notes || ''), req.authUser!.id);

      const paymentId = Number(payRes.lastInsertRowid);

      tx.prepare(`UPDATE student_fees SET paid_amount = ?, status = ? WHERE id = ?`).run(nextPaid, updatedSummary.status, studentFeeId);

      // Automatically record linked Income entry inside the same ACID transaction
      const stu = tx.prepare(`SELECT first_name, last_name, user_id FROM students WHERE id = ?`).get(feeRow.student_id) as {
        first_name: string;
        last_name: string;
        user_id: number;
      };
      tx.prepare(
        `INSERT INTO income_records (title, category, amount, income_date, payment_id, description, recorded_by)
         VALUES (?, 'Student Tuition', ?, ?, ?, ?, ?)`
      ).run(`Tuition Receipt ${receiptNumber}`, amount, paymentDate, paymentId, `${stu.first_name} ${stu.last_name} - ${feeRow.title}`, req.authUser!.id);

      return { paymentId, receiptNumber, studentUserId: stu.user_id, remaining: updatedSummary.remaining };
    });

    createNotification({
      title: `Payment Receipt ${result.receiptNumber}`,
      message: `Received ${formatCurrency(amount)}. Remaining balance: ${formatCurrency(result.remaining)}.`,
      type: 'finance',
      targetType: 'individual',
      createdBy: req.authUser!.id,
      recipientUserIds: [result.studentUserId],
    });

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'PAYMENT_RECORDED',
      module: 'finance',
      recordRef: result.receiptNumber,
      details: { amount, studentFeeId },
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ ok: true, id: result.paymentId, receipt_number: result.receiptNumber, remaining: result.remaining });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Payment failed.' });
  }
});

// ─── INCOME & EXPENSES ───────────────────────────────────────────────────────
router.get('/income', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(`SELECT ir.*, u.full_name AS recorded_by_name FROM income_records ir LEFT JOIN users u ON u.id = ir.recorded_by ORDER BY ir.income_date DESC, ir.id DESC`)
    .all();
  res.json({ income: rows });
});

router.post('/income', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || Number(b.amount) <= 0) {
    res.status(400).json({ error: 'Title and positive amount are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO income_records (title, category, amount, income_date, description, attachment_url, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      String(b.title).trim(),
      String(b.category || 'Other Income'),
      Number(b.amount),
      String(b.income_date || new Date().toISOString().slice(0, 10)),
      String(b.description || ''),
      String(b.attachment_url || ''),
      req.authUser!.id
    );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'INCOME_RECORDED', module: 'finance', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.get('/expenses', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(`SELECT er.*, u.full_name AS recorded_by_name FROM expense_records er LEFT JOIN users u ON u.id = er.recorded_by ORDER BY er.expense_date DESC, er.id DESC`)
    .all();
  res.json({ expenses: rows });
});

router.post('/expenses', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || Number(b.amount) <= 0) {
    res.status(400).json({ error: 'Title and positive amount are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO expense_records (title, category, amount, expense_date, description, attachment_url, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      String(b.title).trim(),
      String(b.category || 'General Expense'),
      Number(b.amount),
      String(b.expense_date || new Date().toISOString().slice(0, 10)),
      String(b.description || ''),
      String(b.attachment_url || ''),
      req.authUser!.id
    );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'EXPENSE_RECORDED', module: 'finance', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

// ─── TEACHER SALARIES ────────────────────────────────────────────────────────
router.get('/salaries', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  if (req.authUser!.role === 'teacher') {
    const payments = db
      .prepare(`SELECT sp.*, t.first_name || ' ' || t.last_name AS teacher_name FROM salary_payments sp JOIN teachers t ON t.id = sp.teacher_id WHERE sp.teacher_id = ? ORDER BY sp.payment_date DESC`)
      .all(req.authUser!.teacher_id || 0);
    res.json({ definitions: [], payments });
    return;
  }
  const definitions = db
    .prepare(
      `SELECT sd.*, t.teacher_code, t.first_name || ' ' || t.last_name AS teacher_name
       FROM salary_definitions sd JOIN teachers t ON t.id = sd.teacher_id ORDER BY t.id ASC`
    )
    .all();
  const payments = db
    .prepare(
      `SELECT sp.*, t.teacher_code, t.first_name || ' ' || t.last_name AS teacher_name
       FROM salary_payments sp JOIN teachers t ON t.id = sp.teacher_id ORDER BY sp.payment_date DESC, sp.id DESC`
    )
    .all();
  res.json({ definitions, payments });
});

router.post('/salaries/definitions', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const teacherId = Number(b.teacher_id || 0);
  if (!teacherId) {
    res.status(400).json({ error: 'Teacher is required.' });
    return;
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO salary_definitions (teacher_id, base_amount, allowance, deduction, effective_from, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(teacher_id) DO UPDATE SET base_amount = excluded.base_amount, allowance = excluded.allowance, deduction = excluded.deduction, effective_from = excluded.effective_from, notes = excluded.notes`
  ).run(teacherId, Number(b.base_amount || 0), Number(b.allowance || 0), Number(b.deduction || 0), String(b.effective_from || new Date().toISOString().slice(0, 10)), String(b.notes || ''));
  res.json({ ok: true });
});

router.post('/salaries/payments', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const teacherId = Number(b.teacher_id || 0);
  const payMonth = String(b.pay_month || new Date().toISOString().slice(0, 7));
  const grossAmount = Number(b.gross_amount || 0);
  const paidAmount = Number(b.paid_amount || 0);
  if (!teacherId || paidAmount <= 0) {
    res.status(400).json({ error: 'Teacher and positive payment amount are required.' });
    return;
  }
  const remaining = Math.max(0, Math.round((grossAmount - paidAmount) * 100) / 100);
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO salary_payments (teacher_id, pay_month, gross_amount, paid_amount, remaining_balance, payment_date, payment_method, notes, paid_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(teacherId, payMonth, grossAmount, paidAmount, remaining, String(b.payment_date || new Date().toISOString().slice(0, 10)), String(b.payment_method || 'bank'), String(b.notes || ''), req.authUser!.id);

  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SALARY_PAID', module: 'salaries', recordRef: `tch:${teacherId}@${payMonth}`, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

export default router;
