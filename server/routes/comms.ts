import { Router } from 'express';
import * as XLSX from 'xlsx';
import { createNotification, getDb, logAudit, runTransaction } from '../db/database';
import {
  type AuthedRequest,
  getClientIp,
  getTeacherAssignedClassIds,
  getTeacherAssignedStudentIds,
  requireAuth,
  requireRole,
} from '../middleware/auth';
import { formatCurrency } from '../../src/utils/eduLogic';

const router = Router();
router.use(requireAuth);

// ─── DASHBOARD ANALYTICS (REAL DATABASE DATA ONLY) ───────────────────────────
router.get('/dashboard', (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;

  if (user.role === 'admin') {
    const totalStudents = (db.prepare(`SELECT COUNT(*) AS cnt FROM students`).get() as { cnt: number }).cnt;
    const activeStudents = (db.prepare(`SELECT COUNT(*) AS cnt FROM students WHERE status = 'active'`).get() as { cnt: number }).cnt;
    const totalTeachers = (db.prepare(`SELECT COUNT(*) AS cnt FROM teachers WHERE status = 'active'`).get() as { cnt: number }).cnt;
    const totalCourses = (db.prepare(`SELECT COUNT(*) AS cnt FROM courses`).get() as { cnt: number }).cnt;
    const totalClasses = (db.prepare(`SELECT COUNT(*) AS cnt FROM classes WHERE status = 'active'`).get() as { cnt: number }).cnt;
    const totalIncome = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM income_records`).get() as { total: number }).total;
    const totalExpenses = (db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expense_records`).get() as { total: number }).total;
    const totalSalaries = (db.prepare(`SELECT COALESCE(SUM(paid_amount), 0) AS total FROM salary_payments`).get() as { total: number }).total;
    const outstandingFees = (db.prepare(`SELECT COALESCE(SUM(MAX(0, total_amount - discount_amount - paid_amount)), 0) AS total FROM student_fees`).get() as { total: number }).total;

    const attendanceBreakdown = db
      .prepare(`SELECT status, COUNT(*) AS cnt FROM student_attendance GROUP BY status`)
      .all() as Array<{ status: string; cnt: number }>;

    const recentStudents = db
      .prepare(`SELECT id, student_code, first_name, last_name, admission_date, status FROM students ORDER BY id DESC LIMIT 5`)
      .all();

    const recentActivities = db
      .prepare(`SELECT id, user_name, user_role, action, module, record_ref, result, created_at FROM audit_logs ORDER BY id DESC LIMIT 8`)
      .all();

    const pendingResets = (db.prepare(`SELECT COUNT(*) AS cnt FROM password_reset_requests WHERE status = 'pending'`).get() as { cnt: number }).cnt;
    const pendingSubmissions = (db.prepare(`SELECT COUNT(*) AS cnt FROM homework_submissions WHERE status = 'submitted'`).get() as { cnt: number }).cnt;

    res.json({
      role: 'admin',
      kpis: {
        totalStudents,
        activeStudents,
        totalTeachers,
        totalCourses,
        totalClasses,
        totalIncome,
        totalExpenses: totalExpenses + totalSalaries,
        outstandingFees,
        netBalance: Math.round((totalIncome - totalExpenses - totalSalaries) * 100) / 100,
        pendingResets,
        pendingSubmissions,
      },
      attendanceBreakdown,
      recentStudents,
      recentActivities,
    });
    return;
  }

  if (user.role === 'teacher') {
    const tid = user.teacher_id || 0;
    const classIds = getTeacherAssignedClassIds(tid);
    const studentIds = getTeacherAssignedStudentIds(tid);
    const timetable = db
      .prepare(
        `SELECT tt.*, cl.name AS class_name, sub.name AS subject_name
         FROM timetables tt JOIN classes cl ON cl.id = tt.class_id JOIN subjects sub ON sub.id = tt.subject_id
         WHERE tt.teacher_id = ? ORDER BY tt.start_time ASC`
      )
      .all(tid);
    const pendingReviews = (
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM homework_submissions hs
           JOIN homework h ON h.id = hs.homework_id
           WHERE h.teacher_id = ? AND hs.status = 'submitted'`
        )
        .get(tid) as { cnt: number }
    ).cnt;
    res.json({
      role: 'teacher',
      kpis: {
        assignedClasses: classIds.length,
        assignedStudents: studentIds.length,
        timetableCount: timetable.length,
        pendingReviews,
      },
      timetable,
    });
    return;
  }

  // Student dashboard
  const sid = user.student_id || 0;
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(sid);
  const enrollments = db
    .prepare(
      `SELECT e.*, cl.name AS class_name, c.title AS course_title FROM enrollments e
       JOIN classes cl ON cl.id = e.class_id JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? AND e.status = 'active'`
    )
    .all(sid);
  const attendanceStats = db
    .prepare(`SELECT status, COUNT(*) AS cnt FROM student_attendance WHERE student_id = ? GROUP BY status`)
    .all(sid);
  const recentGrades = db
    .prepare(
      `SELECT eg.score, ex.title, ex.max_score, ex.exam_date, sub.name AS subject_name
       FROM exam_grades eg JOIN examinations ex ON ex.id = eg.exam_id JOIN subjects sub ON sub.id = ex.subject_id
       WHERE eg.student_id = ? AND ex.is_published = 1 ORDER BY ex.exam_date DESC LIMIT 5`
    )
    .all(sid);
  const feeTotals = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount - discount_amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid
       FROM student_fees WHERE student_id = ?`
    )
    .get(sid) as { total: number; paid: number };
  const pendingHomework = (
    db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM homework h
         JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = ? AND e.status = 'active'
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = ?
         WHERE hs.id IS NULL`
      )
      .get(sid, sid) as { cnt: number }
  ).cnt;

  res.json({
    role: 'student',
    student,
    enrollments,
    attendanceStats,
    recentGrades,
    pendingHomework,
    finance: {
      total: feeTotals.total,
      paid: feeTotals.paid,
      balance: Math.max(0, Math.round((feeTotals.total - feeTotals.paid) * 100) / 100),
    },
  });
});

// ─── INTERNAL NOTIFICATIONS ──────────────────────────────────────────────────
router.get('/notifications', (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*, nr.is_read, nr.read_at, u.full_name AS sender_name
       FROM notification_recipients nr
       JOIN notifications n ON n.id = nr.notification_id
       LEFT JOIN users u ON u.id = n.created_by
       WHERE nr.user_id = ?
       ORDER BY n.id DESC LIMIT 100`
    )
    .all(req.authUser!.id);
  const unreadCount = (db.prepare(`SELECT COUNT(*) AS cnt FROM notification_recipients WHERE user_id = ? AND is_read = 0`).get(req.authUser!.id) as { cnt: number }).cnt;
  res.json({ notifications: rows, unreadCount });
});

router.post('/notifications/send', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const message = String(b.message || '').trim();
  const targetType = String(b.target_type || 'all_users');
  if (!title || !message) {
    res.status(400).json({ error: 'Title and message are required.' });
    return;
  }

  const db = getDb();
  let recipientUserIds: number[] = [];

  if (targetType === 'all_users') {
    recipientUserIds = (db.prepare(`SELECT id FROM users WHERE status = 'active'`).all() as Array<{ id: number }>).map((u) => u.id);
  } else if (targetType === 'all_students') {
    recipientUserIds = (db.prepare(`SELECT id FROM users WHERE role = 'student' AND status = 'active'`).all() as Array<{ id: number }>).map((u) => u.id);
  } else if (targetType === 'all_teachers') {
    recipientUserIds = (db.prepare(`SELECT id FROM users WHERE role = 'teacher' AND status = 'active'`).all() as Array<{ id: number }>).map((u) => u.id);
  } else if (targetType === 'class' && b.class_id) {
    recipientUserIds = (
      db.prepare(`SELECT s.user_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.class_id = ? AND e.status = 'active'`).all(Number(b.class_id)) as Array<{ user_id: number }>
    ).map((r) => r.user_id);
  } else if (Array.isArray(b.user_ids)) {
    recipientUserIds = b.user_ids.map(Number);
  }

  const notifId = createNotification({
    title,
    message,
    type: ['info', 'homework', 'exam', 'finance', 'timetable', 'system'].includes(b.type) ? b.type : 'info',
    targetType,
    createdBy: req.authUser!.id,
    recipientUserIds,
  });

  res.status(201).json({ ok: true, id: notifId, recipientCount: recipientUserIds.length });
});

router.post('/notifications/:id/read', (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`UPDATE notification_recipients SET is_read = 1, read_at = datetime('now') WHERE notification_id = ? AND user_id = ?`).run(
    Number(req.params.id),
    req.authUser!.id
  );
  res.json({ ok: true });
});

router.post('/notifications/read-all', (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`UPDATE notification_recipients SET is_read = 1, read_at = datetime('now') WHERE user_id = ? AND is_read = 0`).run(req.authUser!.id);
  res.json({ ok: true });
});

// ─── INTERNAL MESSAGING (PARTICIPANT-ISOLATED) ───────────────────────────────
router.get('/messages/contacts', (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  let contacts: any[] = [];
  if (user.role === 'admin') {
    contacts = db.prepare(`SELECT id, full_name, role, username FROM users WHERE id != ? AND status = 'active' ORDER BY role, full_name`).all(user.id);
  } else if (user.role === 'teacher') {
    const sIds = getTeacherAssignedStudentIds(user.teacher_id || 0);
    const sFilter = sIds.length ? `OR id IN (SELECT user_id FROM students WHERE id IN (${sIds.map(() => '?').join(',')}))` : '';
    contacts = db
      .prepare(`SELECT id, full_name, role, username FROM users WHERE id != ? AND status = 'active' AND (role IN ('admin','teacher') ${sFilter}) ORDER BY role, full_name`)
      .all(user.id, ...sIds);
  } else {
    // Student can message admins and their assigned teachers
    contacts = db
      .prepare(
        `SELECT id, full_name, role, username FROM users
         WHERE id != ? AND status = 'active' AND (
           role = 'admin' OR id IN (
             SELECT t.user_id FROM enrollments e
             JOIN class_subject_teachers cst ON cst.class_id = e.class_id
             JOIN teachers t ON t.id = cst.teacher_id
             WHERE e.student_id = ? AND e.status = 'active'
           )
         ) ORDER BY role, full_name`
      )
      .all(user.id, user.student_id || 0);
  }
  res.json({ contacts });
});

router.get('/messages/conversations', (req: AuthedRequest, res) => {
  const db = getDb();
  const uid = req.authUser!.id;
  const conversations = db
    .prepare(
      `SELECT c.*,
        (SELECT GROUP_CONCAT(u.full_name, ', ') FROM conversation_participants cp2 JOIN users u ON u.id = cp2.user_id WHERE cp2.conversation_id = c.id AND cp2.user_id != ?) AS other_participants,
        (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0) AS unread_count
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all(uid, uid, uid);
  res.json({ conversations });
});

router.get('/messages/conversations/:id', (req: AuthedRequest, res) => {
  const db = getDb();
  const convId = Number(req.params.id);
  const uid = req.authUser!.id;
  const participant = db.prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`).get(convId, uid);
  if (!participant) {
    res.status(403).json({ error: 'Access denied to this conversation.' });
    return;
  }
  db.prepare(`UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ?`).run(convId, uid);
  const messages = db
    .prepare(
      `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.id ASC`
    )
    .all(convId);
  res.json({ messages });
});

router.post('/messages/conversations', (req: AuthedRequest, res) => {
  const db = getDb();
  const uid = req.authUser!.id;
  const recipientId = Number(req.body?.recipient_id || 0);
  const subject = String(req.body?.subject || 'Direct Message').trim();
  const body = String(req.body?.body || '').trim();
  if (!recipientId || !body) {
    res.status(400).json({ error: 'Recipient and message body are required.' });
    return;
  }
  const convId = runTransaction((tx) => {
    const cRes = tx.prepare(`INSERT INTO conversations (subject) VALUES (?)`).run(subject);
    const id = Number(cRes.lastInsertRowid);
    tx.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, uid);
    tx.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`).run(id, recipientId);
    tx.prepare(`INSERT INTO messages (conversation_id, sender_id, body, attachment_url, attachment_name) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      uid,
      body,
      String(req.body?.attachment_url || ''),
      String(req.body?.attachment_name || '')
    );
    return id;
  });

  createNotification({
    title: `New Message from ${req.authUser!.full_name}`,
    message: subject,
    type: 'info',
    targetType: 'individual',
    createdBy: uid,
    recipientUserIds: [recipientId],
  });
  res.status(201).json({ ok: true, id: convId });
});

router.post('/messages/conversations/:id/reply', (req: AuthedRequest, res) => {
  const db = getDb();
  const convId = Number(req.params.id);
  const uid = req.authUser!.id;
  const participant = db.prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`).get(convId, uid);
  if (!participant) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  const body = String(req.body?.body || '').trim();
  if (!body) {
    res.status(400).json({ error: 'Message text is required.' });
    return;
  }
  db.prepare(`INSERT INTO messages (conversation_id, sender_id, body, attachment_url, attachment_name) VALUES (?, ?, ?, ?, ?)`).run(
    convId,
    uid,
    body,
    String(req.body?.attachment_url || ''),
    String(req.body?.attachment_name || '')
  );
  db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(convId);

  const others = (
    db.prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?`).all(convId, uid) as Array<{ user_id: number }>
  ).map((r) => r.user_id);
  createNotification({
    title: `Reply from ${req.authUser!.full_name}`,
    message: body.slice(0, 100),
    type: 'info',
    targetType: 'individual',
    createdBy: uid,
    recipientUserIds: others,
  });
  res.status(201).json({ ok: true });
});

// ─── GLOBAL SEARCH (PERMISSION-SCOPED) ───────────────────────────────────────
router.get('/search', (req: AuthedRequest, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ results: [] });
    return;
  }
  const like = `%${q}%`;
  const user = req.authUser!;
  const results: Array<{ type: string; id: number; title: string; subtitle: string; url: string }> = [];

  if (user.role === 'admin') {
    const students = db.prepare(`SELECT id, student_code, first_name, last_name FROM students WHERE student_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 5`).all(like, like, like) as any[];
    for (const s of students) results.push({ type: 'student', id: s.id, title: `${s.first_name} ${s.last_name}`, subtitle: s.student_code, url: '/admin/students' });

    const teachers = db.prepare(`SELECT id, teacher_code, first_name, last_name, specialization FROM teachers WHERE teacher_code LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 5`).all(like, like, like) as any[];
    for (const t of teachers) results.push({ type: 'teacher', id: t.id, title: `${t.first_name} ${t.last_name}`, subtitle: `${t.teacher_code} · ${t.specialization}`, url: '/admin/teachers' });

    const payments = db.prepare(`SELECT id, receipt_number, amount, payment_date FROM payments WHERE receipt_number LIKE ? LIMIT 5`).all(like) as any[];
    for (const p of payments) results.push({ type: 'payment', id: p.id, title: p.receipt_number, subtitle: `${formatCurrency(p.amount)} · ${p.payment_date}`, url: '/admin/finance' });
  } else if (user.role === 'teacher') {
    const sIds = getTeacherAssignedStudentIds(user.teacher_id || 0);
    if (sIds.length > 0) {
      const students = db
        .prepare(`SELECT id, student_code, first_name, last_name FROM students WHERE id IN (${sIds.map(() => '?').join(',')}) AND (student_code LIKE ? OR first_name LIKE ? OR last_name LIKE ?) LIMIT 5`)
        .all(...sIds, like, like, like) as any[];
      for (const s of students) results.push({ type: 'student', id: s.id, title: `${s.first_name} ${s.last_name}`, subtitle: s.student_code, url: '/teacher/classes' });
    }
  }

  const courses = db.prepare(`SELECT id, course_code, title FROM courses WHERE title LIKE ? OR course_code LIKE ? LIMIT 5`).all(like, like) as any[];
  for (const c of courses) results.push({ type: 'course', id: c.id, title: c.title, subtitle: c.course_code, url: user.role === 'admin' ? '/admin/academics' : `/${user.role}` });

  const classes = db.prepare(`SELECT id, class_code, name FROM classes WHERE name LIKE ? OR class_code LIKE ? LIMIT 5`).all(like, like) as any[];
  for (const cl of classes) results.push({ type: 'class', id: cl.id, title: cl.name, subtitle: cl.class_code, url: user.role === 'admin' ? '/admin/academics' : `/${user.role}` });

  res.json({ results });
});

// ─── REPORTS & REAL EXCEL (.XLSX) EXPORT ─────────────────────────────────────
function getReportDataset(type: string, user: AuthedRequest['authUser']): { columns: string[]; rows: any[] } {
  const db = getDb();
  if (!user) return { columns: [], rows: [] };

  // Role permission checks on reports
  const adminOnlyReports = ['fee_payments', 'outstanding_balances', 'income', 'expenses', 'teacher_salaries', 'teacher_attendance', 'certificates'];
  if (adminOnlyReports.includes(type) && user.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }

  switch (type) {
    case 'student_enrollment': {
      const where = user.role === 'teacher' ? `WHERE e.class_id IN (SELECT class_id FROM class_subject_teachers WHERE teacher_id = ${Number(user.teacher_id || 0)})` : user.role === 'student' ? `WHERE e.student_id = ${Number(user.student_id || 0)}` : '';
      const rows = db.prepare(`SELECT s.student_code, s.first_name || ' ' || s.last_name AS student_name, c.title AS course_title, cl.name AS class_name, e.enrolled_at, e.status FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id JOIN classes cl ON cl.id = e.class_id ${where} ORDER BY e.id DESC`).all();
      return { columns: ['student_code', 'student_name', 'course_title', 'class_name', 'enrolled_at', 'status'], rows };
    }
    case 'student_attendance': {
      const where = user.role === 'teacher' ? `WHERE sa.class_id IN (SELECT class_id FROM class_subject_teachers WHERE teacher_id = ${Number(user.teacher_id || 0)})` : user.role === 'student' ? `WHERE sa.student_id = ${Number(user.student_id || 0)}` : '';
      const rows = db.prepare(`SELECT sa.attendance_date, cl.name AS class_name, s.student_code, s.first_name || ' ' || s.last_name AS student_name, sa.session_label, sa.status, sa.remarks FROM student_attendance sa JOIN classes cl ON cl.id = sa.class_id JOIN students s ON s.id = sa.student_id ${where} ORDER BY sa.attendance_date DESC`).all();
      return { columns: ['attendance_date', 'class_name', 'student_code', 'student_name', 'session_label', 'status', 'remarks'], rows };
    }
    case 'teacher_attendance': {
      const rows = db.prepare(`SELECT ta.attendance_date, t.teacher_code, t.first_name || ' ' || t.last_name AS teacher_name, ta.status, ta.check_in_time, ta.check_out_time FROM teacher_attendance ta JOIN teachers t ON t.id = ta.teacher_id ORDER BY ta.attendance_date DESC`).all();
      return { columns: ['attendance_date', 'teacher_code', 'teacher_name', 'status', 'check_in_time', 'check_out_time'], rows };
    }
    case 'class_capacity': {
      const rows = db.prepare(`SELECT cl.class_code, cl.name AS class_name, c.title AS course_title, cl.capacity, (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cl.id AND e.status = 'active') AS enrolled, cl.room, cl.status FROM classes cl JOIN courses c ON c.id = cl.course_id ORDER BY cl.id DESC`).all();
      return { columns: ['class_code', 'class_name', 'course_title', 'capacity', 'enrolled', 'room', 'status'], rows };
    }
    case 'exam_results': {
      const where = user.role === 'teacher' ? `WHERE ex.class_id IN (SELECT class_id FROM class_subject_teachers WHERE teacher_id = ${Number(user.teacher_id || 0)})` : user.role === 'student' ? `WHERE eg.student_id = ${Number(user.student_id || 0)} AND ex.is_published = 1` : '';
      const rows = db.prepare(`SELECT ex.exam_date, ex.title AS exam_title, sub.name AS subject_name, s.student_code, s.first_name || ' ' || s.last_name AS student_name, eg.score, ex.max_score, eg.feedback FROM exam_grades eg JOIN examinations ex ON ex.id = eg.exam_id JOIN subjects sub ON sub.id = ex.subject_id JOIN students s ON s.id = eg.student_id ${where} ORDER BY ex.exam_date DESC`).all();
      return { columns: ['exam_date', 'exam_title', 'subject_name', 'student_code', 'student_name', 'score', 'max_score', 'feedback'], rows };
    }
    case 'homework_performance': {
      const where = user.role === 'teacher' ? `WHERE h.teacher_id = ${Number(user.teacher_id || 0)}` : user.role === 'student' ? `WHERE hs.student_id = ${Number(user.student_id || 0)}` : '';
      const rows = db.prepare(`SELECT h.title AS homework_title, h.due_date, s.student_code, s.first_name || ' ' || s.last_name AS student_name, hs.submitted_at, hs.is_late, hs.score, hs.status FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id JOIN students s ON s.id = hs.student_id ${where} ORDER BY hs.submitted_at DESC`).all();
      return { columns: ['homework_title', 'due_date', 'student_code', 'student_name', 'submitted_at', 'is_late', 'score', 'status'], rows };
    }
    case 'fee_payments': {
      const rows = db.prepare(`SELECT p.receipt_number, p.payment_date, s.student_code, s.first_name || ' ' || s.last_name AS student_name, sf.title AS fee_title, p.amount, p.payment_method FROM payments p JOIN students s ON s.id = p.student_id JOIN student_fees sf ON sf.id = p.student_fee_id ORDER BY p.payment_date DESC`).all();
      return { columns: ['receipt_number', 'payment_date', 'student_code', 'student_name', 'fee_title', 'amount', 'payment_method'], rows };
    }
    case 'outstanding_balances': {
      const rows = db.prepare(`SELECT s.student_code, s.first_name || ' ' || s.last_name AS student_name, sf.title AS fee_title, sf.total_amount, sf.discount_amount, sf.paid_amount, MAX(0, sf.total_amount - sf.discount_amount - sf.paid_amount) AS balance_due, sf.due_date, sf.status FROM student_fees sf JOIN students s ON s.id = sf.student_id WHERE sf.status != 'paid' ORDER BY sf.due_date ASC`).all();
      return { columns: ['student_code', 'student_name', 'fee_title', 'total_amount', 'discount_amount', 'paid_amount', 'balance_due', 'due_date', 'status'], rows };
    }
    case 'income': {
      const rows = db.prepare(`SELECT income_date, title, category, amount, description FROM income_records ORDER BY income_date DESC`).all();
      return { columns: ['income_date', 'title', 'category', 'amount', 'description'], rows };
    }
    case 'expenses': {
      const rows = db.prepare(`SELECT expense_date, title, category, amount, description FROM expense_records ORDER BY expense_date DESC`).all();
      return { columns: ['expense_date', 'title', 'category', 'amount', 'description'], rows };
    }
    case 'teacher_salaries': {
      const rows = db.prepare(`SELECT sp.pay_month, t.teacher_code, t.first_name || ' ' || t.last_name AS teacher_name, sp.gross_amount, sp.paid_amount, sp.remaining_balance, sp.payment_date FROM salary_payments sp JOIN teachers t ON t.id = sp.teacher_id ORDER BY sp.payment_date DESC`).all();
      return { columns: ['pay_month', 'teacher_code', 'teacher_name', 'gross_amount', 'paid_amount', 'remaining_balance', 'payment_date'], rows };
    }
    case 'certificates': {
      const rows = db.prepare(`SELECT cert.certificate_number, cert.issue_date, s.student_code, s.first_name || ' ' || s.last_name AS student_name, c.title AS course_title, cert.grade_summary FROM certificates cert JOIN students s ON s.id = cert.student_id LEFT JOIN courses c ON c.id = cert.course_id ORDER BY cert.issue_date DESC`).all();
      return { columns: ['certificate_number', 'issue_date', 'student_code', 'student_name', 'course_title', 'grade_summary'], rows };
    }
    default:
      return { columns: [], rows: [] };
  }
}

router.get('/reports/:type', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  try {
    const data = getReportDataset(req.params.type, req.authUser);
    res.json(data);
  } catch (err: any) {
    if (err?.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden report type for your role.' });
      return;
    }
    res.status(400).json({ error: 'Failed to generate report.' });
  }
});

router.get('/reports/:type/excel', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  try {
    const { rows } = getReportDataset(req.params.type, req.authUser);
    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ message: 'No records' }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, req.params.type.slice(0, 31));
    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: req.authUser!.role,
      action: 'EXCEL_EXPORTED',
      module: 'reports',
      recordRef: req.params.type,
      ipAddress: getClientIp(req),
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="danesh_${req.params.type}_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (err: any) {
    if (err?.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden report export.' });
      return;
    }
    res.status(400).json({ error: 'Excel export failed.' });
  }
});

export default router;
