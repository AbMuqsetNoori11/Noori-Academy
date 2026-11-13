import { Router } from 'express';
import { createNotification, getDb, logAudit, runTransaction } from '../db/database';
import { type AuthedRequest, getClientIp, requireAuth, requireRole } from '../middleware/auth';
import { formatCode } from '../../src/utils/eduLogic';

const router = Router();
router.use(requireAuth);

// ─── STUDENT ID CARDS ────────────────────────────────────────────────────────
router.get('/id-cards/templates', requireRole('admin'), (_req, res) => {
  const db = getDb();
  res.json({ templates: db.prepare(`SELECT * FROM id_card_templates ORDER BY is_default DESC, id DESC`).all() });
});

router.post('/id-cards/templates', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name) {
    res.status(400).json({ error: 'Template name is required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO id_card_templates (name, orientation, width_mm, height_mm, bg_color, accent_color, text_color, bg_image_url, logo_url, layout_json, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.name).trim(),
      b.orientation === 'portrait' ? 'portrait' : 'landscape',
      Number(b.width_mm || 85.6),
      Number(b.height_mm || 54),
      String(b.bg_color || '#ffffff'),
      String(b.accent_color || '#1e3a8a'),
      String(b.text_color || '#0f172a'),
      String(b.bg_image_url || ''),
      String(b.logo_url || ''),
      typeof b.layout_json === 'string' ? b.layout_json : JSON.stringify(b.layout_json || {}),
      b.is_default ? 1 : 0
    );
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/id-cards/templates/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(
    `UPDATE id_card_templates SET name=?, orientation=?, width_mm=?, height_mm=?, bg_color=?, accent_color=?, text_color=?, bg_image_url=?, logo_url=?, layout_json=?, is_default=? WHERE id=?`
  ).run(
    String(b.name || 'Template'),
    b.orientation === 'portrait' ? 'portrait' : 'landscape',
    Number(b.width_mm || 85.6),
    Number(b.height_mm || 54),
    String(b.bg_color || '#ffffff'),
    String(b.accent_color || '#1e3a8a'),
    String(b.text_color || '#0f172a'),
    String(b.bg_image_url || ''),
    String(b.logo_url || ''),
    typeof b.layout_json === 'string' ? b.layout_json : JSON.stringify(b.layout_json || {}),
    b.is_default ? 1 : 0,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

router.get('/id-cards', requireRole('admin'), (_req: AuthedRequest, res) => {
  const db = getDb();
  const where = '';
  const params: any[] = [];

  const cards = db
    .prepare(
      `SELECT ic.*, s.student_code, s.first_name, s.last_name, s.father_name, s.photo_url, s.phone,
              t.name AS template_name, t.orientation, t.width_mm, t.height_mm, t.bg_color, t.accent_color, t.text_color, t.bg_image_url, t.logo_url, t.layout_json,
              (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS class_name,
              (SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS course_title
       FROM id_card_records ic
       JOIN students s ON s.id = ic.student_id
       JOIN id_card_templates t ON t.id = ic.template_id
       ${where}
       ORDER BY ic.id DESC`
    )
    .all(...params);
  res.json({ cards });
});

router.post('/id-cards/issue', requireRole('admin'), (req: AuthedRequest, res) => {
  const studentIds: number[] = Array.isArray(req.body?.student_ids) ? req.body.student_ids.map(Number) : [];
  const templateId = Number(req.body?.template_id || 0);
  const issueDate = String(req.body?.issue_date || new Date().toISOString().slice(0, 10));
  const expiryDate = String(req.body?.expiry_date || '');

  if (studentIds.length === 0 || !templateId) {
    res.status(400).json({ error: 'Select at least one student and a card template.' });
    return;
  }

  const result = runTransaction((tx) => {
    let issued = 0;
    let skipped = 0;
    for (const sid of studentIds) {
      // Prevent accidental duplicate active card for same student & template
      const exists = tx
        .prepare(`SELECT id FROM id_card_records WHERE student_id = ? AND template_id = ? AND status = 'active'`)
        .get(sid, templateId);
      if (exists) {
        skipped++;
        continue;
      }
      const nxt = (tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM id_card_records`).get() as { nxt: number }).nxt;
      const cardNumber = `IDC-2026-${formatCode('', nxt, 4).replace('-', '')}`;
      tx.prepare(
        `INSERT INTO id_card_records (card_number, student_id, template_id, issue_date, expiry_date, status, issued_by)
         VALUES (?, ?, ?, ?, ?, 'active', ?)`
      ).run(cardNumber, sid, templateId, issueDate, expiryDate, req.authUser!.id);
      issued++;
    }
    return { issued, skipped };
  });

  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'ID_CARDS_ISSUED', module: 'id-cards', details: result, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, ...result });
});

// ─── CERTIFICATES ────────────────────────────────────────────────────────────
router.get('/certificates/templates', requireRole('admin'), (_req, res) => {
  const db = getDb();
  res.json({ templates: db.prepare(`SELECT * FROM certificate_templates ORDER BY is_default DESC, id DESC`).all() });
});

router.post('/certificates/templates', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name || !b.body_template) {
    res.status(400).json({ error: 'Template name and body template are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO certificate_templates (name, paper_size, orientation, bg_color, border_color, accent_color, bg_image_url, logo_url, seal_text, signature_left_label, signature_right_label, body_template, layout_json, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.name).trim(),
      b.paper_size === 'Letter' ? 'Letter' : 'A4',
      b.orientation === 'portrait' ? 'portrait' : 'landscape',
      String(b.bg_color || '#fffdf7'),
      String(b.border_color || '#b45309'),
      String(b.accent_color || '#1e3a8a'),
      String(b.bg_image_url || ''),
      String(b.logo_url || ''),
      '',
      String(b.signature_left_label || 'Academic Director'),
      String(b.signature_right_label || 'Center Principal'),
      String(b.body_template),
      typeof b.layout_json === 'string' ? b.layout_json : JSON.stringify(b.layout_json || {}),
      b.is_default ? 1 : 0
    );
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/certificates/templates/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(
    `UPDATE certificate_templates SET name=?, paper_size=?, orientation=?, bg_color=?, border_color=?, accent_color=?, bg_image_url=?, logo_url=?, seal_text=?, signature_left_label=?, signature_right_label=?, body_template=?, layout_json=?, is_default=? WHERE id=?`
  ).run(
    String(b.name || 'Certificate Template'),
    b.paper_size === 'Letter' ? 'Letter' : 'A4',
    b.orientation === 'portrait' ? 'portrait' : 'landscape',
    String(b.bg_color || '#fffdf7'),
    String(b.border_color || '#b45309'),
    String(b.accent_color || '#1e3a8a'),
    String(b.bg_image_url || ''),
    String(b.logo_url || ''),
    '',
    String(b.signature_left_label || 'Academic Director'),
    String(b.signature_right_label || 'Center Principal'),
    String(b.body_template || ''),
    typeof b.layout_json === 'string' ? b.layout_json : JSON.stringify(b.layout_json || {}),
    b.is_default ? 1 : 0,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

router.get('/certificates', requireRole('admin'), (_req: AuthedRequest, res) => {
  const db = getDb();
  const where = '';
  const params: any[] = [];

  const certificates = db
    .prepare(
      `SELECT cert.*, s.student_code, s.first_name, s.last_name, s.photo_url,
              c.title AS course_title, cl.name AS class_name,
              t.name AS template_name, t.paper_size, t.orientation, t.bg_color, t.border_color, t.accent_color,
              t.bg_image_url, t.logo_url, t.seal_text, t.signature_left_label, t.signature_right_label, t.body_template, t.layout_json
       FROM certificates cert
       JOIN students s ON s.id = cert.student_id
       LEFT JOIN courses c ON c.id = cert.course_id
       LEFT JOIN classes cl ON cl.id = cert.class_id
       JOIN certificate_templates t ON t.id = cert.template_id
       ${where}
       ORDER BY cert.id DESC`
    )
    .all(...params);
  res.json({ certificates });
});

router.post('/certificates/issue', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const studentIds: number[] = Array.isArray(b.student_ids) ? b.student_ids.map(Number) : [];
  const templateId = Number(b.template_id || 0);
  const courseId = b.course_id ? Number(b.course_id) : null;
  const classId = b.class_id ? Number(b.class_id) : null;
  const issueDate = String(b.issue_date || new Date().toISOString().slice(0, 10));

  if (studentIds.length === 0 || !templateId) {
    res.status(400).json({ error: 'Select at least one student and a certificate template.' });
    return;
  }

  const result = runTransaction((tx) => {
    let issued = 0;
    let skipped = 0;
    const recipientUserIds: number[] = [];

    for (const sid of studentIds) {
      const existing = tx
        .prepare(`SELECT id FROM certificates WHERE student_id = ? AND template_id = ? AND COALESCE(course_id, 0) = COALESCE(?, 0)`)
        .get(sid, templateId, courseId);
      if (existing) {
        skipped++;
        continue;
      }
      const nxt = (tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM certificates`).get() as { nxt: number }).nxt;
      const certNum = `CERT-2026-${formatCode('', nxt, 4).replace('-', '')}`;
      tx.prepare(
        `INSERT INTO certificates (certificate_number, student_id, course_id, class_id, template_id, issue_date, grade_summary, remarks, issued_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(certNum, sid, courseId, classId, templateId, issueDate, String(b.grade_summary || 'Distinction'), String(b.remarks || ''), req.authUser!.id);
      const stu = tx.prepare(`SELECT user_id FROM students WHERE id = ?`).get(sid) as { user_id: number } | undefined;
      if (stu) recipientUserIds.push(stu.user_id);
      issued++;
    }
    return { issued, skipped, recipientUserIds };
  });

  if (result.recipientUserIds.length > 0) {
    createNotification({
      title: 'Official Certificate Issued',
      message: 'A new academic certificate has been issued to your profile.',
      type: 'info',
      targetType: 'selected',
      createdBy: req.authUser!.id,
      recipientUserIds: result.recipientUserIds,
    });
  }

  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'CERTIFICATES_ISSUED', module: 'certificates', details: { issued: result.issued, skipped: result.skipped }, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, issued: result.issued, skipped: result.skipped });
});

export default router;
