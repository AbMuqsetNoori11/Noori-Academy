import { Router } from 'express';
import { createNotification, getDb, logAudit, runTransaction } from '../db/database';
import {
  type AuthedRequest,
  getClientIp,
  getTeacherAssignedClassIds,
  isTeacherAssignedToClassSubject,
  requireAuth,
  requireRole,
} from '../middleware/auth';
import { evaluateGrade, type GradingRule } from '../../src/utils/eduLogic';

const router = Router();
router.use(requireAuth);

// ─── STUDENT & TEACHER ATTENDANCE ────────────────────────────────────────────
router.get('/attendance/students', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  const classId = Number(req.query.class_id || 0);
  const date = String(req.query.date || '');

  if (user.role === 'student') {
    const records = db
      .prepare(
        `SELECT sa.*, cl.name AS class_name FROM student_attendance sa
         JOIN classes cl ON cl.id = sa.class_id
         WHERE sa.student_id = ? ORDER BY sa.attendance_date DESC`
      )
      .all(user.student_id || 0);
    res.json({ records });
    return;
  }

  if (user.role === 'teacher' && classId > 0 && !isTeacherAssignedToClassSubject(user.teacher_id || 0, classId)) {
    res.status(403).json({ error: 'You are not assigned to this class.' });
    return;
  }

  if (classId > 0 && date) {
    const roster = db
      .prepare(
        `SELECT s.id AS student_id, s.student_code, s.first_name, s.last_name,
                COALESCE(sa.status, 'present') AS status,
                COALESCE(sa.remarks, '') AS remarks,
                sa.id AS attendance_id
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         LEFT JOIN student_attendance sa ON sa.student_id = s.id AND sa.class_id = e.class_id AND sa.attendance_date = ? AND sa.session_label = ?
         WHERE e.class_id = ? AND e.status = 'active'
         ORDER BY s.first_name ASC, s.last_name ASC`
      )
      .all(date, String(req.query.session_label || 'Morning'), classId);
    res.json({ roster });
    return;
  }

  let where = '';
  let params: any[] = [];
  if (user.role === 'teacher') {
    const cids = getTeacherAssignedClassIds(user.teacher_id || 0);
    if (cids.length === 0) {
      res.json({ records: [] });
      return;
    }
    where = `WHERE sa.class_id IN (${cids.map(() => '?').join(',')})`;
    params = cids;
  }

  const records = db
    .prepare(
      `SELECT sa.*, cl.name AS class_name, s.student_code, s.first_name || ' ' || s.last_name AS student_name
       FROM student_attendance sa
       JOIN classes cl ON cl.id = sa.class_id
       JOIN students s ON s.id = sa.student_id
       ${where}
       ORDER BY sa.attendance_date DESC, sa.id DESC LIMIT 200`
    )
    .all(...params);
  res.json({ records });
});

router.post('/attendance/students', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const classId = Number(req.body?.class_id || 0);
  const date = String(req.body?.attendance_date || '');
  const sessionLabel = String(req.body?.session_label || 'Morning').trim() || 'Morning';
  const entries: Array<{ student_id: number; status: string; remarks?: string }> = Array.isArray(req.body?.entries) ? req.body.entries : [];

  if (!classId || !date || entries.length === 0) {
    res.status(400).json({ error: 'Class, date, and attendance entries are required.' });
    return;
  }

  if (user.role === 'teacher' && !isTeacherAssignedToClassSubject(user.teacher_id || 0, classId)) {
    res.status(403).json({ error: 'You are not authorized to record attendance for this class.' });
    return;
  }

  let corrections = 0;
  runTransaction((tx) => {
    const checkExisting = tx.prepare(
      `SELECT id, status FROM student_attendance WHERE class_id = ? AND student_id = ? AND attendance_date = ? AND session_label = ?`
    );
    const upsert = tx.prepare(
      `INSERT INTO student_attendance (class_id, student_id, attendance_date, session_label, status, remarks, recorded_by, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(class_id, student_id, attendance_date, session_label)
       DO UPDATE SET status = excluded.status, remarks = excluded.remarks, updated_by = excluded.updated_by, updated_at = datetime('now')`
    );

    for (const item of entries) {
      const validStatus = ['present', 'absent', 'late', 'excused'].includes(item.status) ? item.status : 'present';
      const prev = checkExisting.get(classId, item.student_id, date, sessionLabel) as { id: number; status: string } | undefined;
      if (prev && prev.status !== validStatus) {
        corrections++;
      }
      upsert.run(classId, item.student_id, date, sessionLabel, validStatus, String(item.remarks || ''), user.id, user.id);
    }
  });

  logAudit({
    userId: user.id,
    userName: user.username,
    userRole: user.role,
    action: corrections > 0 ? 'ATTENDANCE_CORRECTED' : 'ATTENDANCE_RECORDED',
    module: 'attendance',
    recordRef: `class:${classId}@${date}`,
    details: { count: entries.length, corrections },
    ipAddress: getClientIp(req),
  });

  res.json({ ok: true, count: entries.length, corrections });
});

router.get('/attendance/teachers', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  if (user.role === 'teacher') {
    const rows = db
      .prepare(`SELECT ta.*, t.first_name || ' ' || t.last_name AS teacher_name FROM teacher_attendance ta JOIN teachers t ON t.id = ta.teacher_id WHERE ta.teacher_id = ? ORDER BY ta.attendance_date DESC`)
      .all(user.teacher_id || 0);
    res.json({ records: rows });
    return;
  }
  const rows = db
    .prepare(`SELECT ta.*, t.teacher_code, t.first_name || ' ' || t.last_name AS teacher_name FROM teacher_attendance ta JOIN teachers t ON t.id = ta.teacher_id ORDER BY ta.attendance_date DESC, ta.id DESC LIMIT 200`)
    .all();
  res.json({ records: rows });
});

router.post('/attendance/teachers', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const b = req.body || {};
  const teacherId = user.role === 'teacher' ? Number(user.teacher_id) : Number(b.teacher_id);
  const date = String(b.attendance_date || new Date().toISOString().slice(0, 10));
  const status = ['present', 'absent', 'late', 'excused'].includes(b.status) ? b.status : 'present';

  if (!teacherId) {
    res.status(400).json({ error: 'Teacher is required.' });
    return;
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO teacher_attendance (teacher_id, attendance_date, status, check_in_time, check_out_time, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(teacher_id, attendance_date)
     DO UPDATE SET status = excluded.status, check_in_time = excluded.check_in_time, check_out_time = excluded.check_out_time, remarks = excluded.remarks`
  ).run(teacherId, date, status, String(b.check_in_time || ''), String(b.check_out_time || ''), String(b.remarks || ''), user.id);

  logAudit({ userId: user.id, userName: user.username, userRole: user.role, action: 'TEACHER_ATTENDANCE_SAVED', module: 'attendance', recordRef: `tch:${teacherId}@${date}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

// ─── CONFIGURABLE GRADING RULES & EXAMINATIONS ───────────────────────────────
router.get('/grading-rules', (_req, res) => {
  const db = getDb();
  res.json({ rules: db.prepare(`SELECT * FROM grading_rules ORDER BY min_percent DESC`).all() });
});

router.put('/grading-rules', requireRole('admin'), (req: AuthedRequest, res) => {
  const rules: GradingRule[] = Array.isArray(req.body?.rules) ? req.body.rules : [];
  if (rules.length === 0) {
    res.status(400).json({ error: 'At least one grading rule is required.' });
    return;
  }
  runTransaction((tx) => {
    tx.prepare(`DELETE FROM grading_rules`).run();
    const ins = tx.prepare(`INSERT INTO grading_rules (grade_letter, min_percent, max_percent, gpa_points, description, is_passing) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const r of rules) {
      ins.run(String(r.grade_letter), Number(r.min_percent), Number(r.max_percent), Number(r.gpa_points), String(r.description || ''), r.is_passing ? 1 : 0);
    }
  });
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'GRADING_RULES_UPDATED', module: 'examinations', ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.get('/exams', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  let where = '';
  let params: any[] = [];

  if (user.role === 'teacher') {
    const classIds = getTeacherAssignedClassIds(user.teacher_id || 0);
    if (classIds.length === 0) {
      res.json({ exams: [] });
      return;
    }
    where = `WHERE ex.class_id IN (${classIds.map(() => '?').join(',')})`;
    params = classIds;
  } else if (user.role === 'student') {
    where = `WHERE ex.class_id IN (SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active')`;
    params = [user.student_id || 0];
  }

  const exams = db
    .prepare(
      `SELECT ex.*, cl.name AS class_name, sub.name AS subject_name,
        (SELECT COUNT(*) FROM exam_grades eg WHERE eg.exam_id = ex.id) AS graded_count
       FROM examinations ex
       JOIN classes cl ON cl.id = ex.class_id
       JOIN subjects sub ON sub.id = ex.subject_id
       ${where}
       ORDER BY ex.exam_date DESC, ex.id DESC`
    )
    .all(...params);
  res.json({ exams });
});

router.post('/exams', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const b = req.body || {};
  const classId = Number(b.class_id || 0);
  const subjectId = Number(b.subject_id || 0);
  if (!b.title || !classId || !subjectId || !b.exam_date) {
    res.status(400).json({ error: 'Title, class, subject, and exam date are required.' });
    return;
  }
  if (user.role === 'teacher' && !isTeacherAssignedToClassSubject(user.teacher_id || 0, classId, subjectId)) {
    res.status(403).json({ error: 'You are not assigned to teach this subject in this class.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO examinations (title, exam_type, class_id, subject_id, exam_date, max_score, passing_score, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title).trim(),
      String(b.exam_type || 'midterm'),
      classId,
      subjectId,
      String(b.exam_date),
      Number(b.max_score || 100),
      Number(b.passing_score || 50),
      b.is_published ? 1 : 0,
      user.id
    );
  logAudit({ userId: user.id, userName: user.username, userRole: user.role, action: 'EXAM_CREATED', module: 'examinations', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.get('/exams/:id/grades', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = Number(req.params.id);
  const user = req.authUser!;
  const exam = db.prepare(`SELECT * FROM examinations WHERE id = ?`).get(examId) as any;
  if (!exam) {
    res.status(404).json({ error: 'Examination not found' });
    return;
  }
  if (user.role === 'teacher' && !isTeacherAssignedToClassSubject(user.teacher_id || 0, exam.class_id, exam.subject_id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const rules = db.prepare(`SELECT * FROM grading_rules ORDER BY min_percent DESC`).all() as unknown as GradingRule[];

  if (user.role === 'student') {
    if (!exam.is_published) {
      res.json({ exam, grades: [] });
      return;
    }
    const row = db
      .prepare(`SELECT eg.*, s.student_code, s.first_name || ' ' || s.last_name AS student_name FROM exam_grades eg JOIN students s ON s.id = eg.student_id WHERE eg.exam_id = ? AND eg.student_id = ?`)
      .get(examId, user.student_id || 0) as any;
    const grades = row ? [{ ...row, evaluated: evaluateGrade(row.score, exam.max_score, rules) }] : [];
    res.json({ exam, grades });
    return;
  }

  const roster = db
    .prepare(
      `SELECT s.id AS student_id, s.student_code, s.first_name || ' ' || s.last_name AS student_name,
              eg.score, eg.feedback
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN exam_grades eg ON eg.exam_id = ? AND eg.student_id = s.id
       WHERE e.class_id = ? AND e.status = 'active'
       ORDER BY s.first_name ASC`
    )
    .all(examId, exam.class_id) as any[];

  const enriched = roster.map((r) => ({
    ...r,
    evaluated: r.score !== null && r.score !== undefined ? evaluateGrade(r.score, exam.max_score, rules) : null,
  }));
  res.json({ exam, grades: enriched });
});

router.post('/exams/:id/grades', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  const examId = Number(req.params.id);
  const user = req.authUser!;
  const exam = db.prepare(`SELECT * FROM examinations WHERE id = ?`).get(examId) as any;
  if (!exam) {
    res.status(404).json({ error: 'Examination not found' });
    return;
  }
  if (user.role === 'teacher' && !isTeacherAssignedToClassSubject(user.teacher_id || 0, exam.class_id, exam.subject_id)) {
    res.status(403).json({ error: 'You are not authorized to grade this exam.' });
    return;
  }

  const grades: Array<{ student_id: number; score: number; feedback?: string }> = Array.isArray(req.body?.grades) ? req.body.grades : [];
  const publish = req.body?.is_published;

  runTransaction((tx) => {
    const upsert = tx.prepare(
      `INSERT INTO exam_grades (exam_id, student_id, score, feedback, graded_by, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(exam_id, student_id) DO UPDATE SET score = excluded.score, feedback = excluded.feedback, graded_by = excluded.graded_by, updated_at = datetime('now')`
    );
    for (const g of grades) {
      if (g.score === null || g.score === undefined || Number.isNaN(Number(g.score))) continue;
      const bounded = Math.max(0, Math.min(exam.max_score, Number(g.score)));
      upsert.run(examId, g.student_id, bounded, String(g.feedback || ''), user.id);
    }
    if (publish !== undefined) {
      tx.prepare(`UPDATE examinations SET is_published = ? WHERE id = ?`).run(publish ? 1 : 0, examId);
    }
  });

  if (publish) {
    const recipients = (
      db
        .prepare(`SELECT s.user_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.class_id = ? AND e.status = 'active'`)
        .all(exam.class_id) as Array<{ user_id: number }>
    ).map((r) => r.user_id);
    createNotification({
      title: `Exam Results Published: ${exam.title}`,
      message: 'Your examination grades have been published and are ready for review.',
      type: 'exam',
      targetType: 'class',
      createdBy: user.id,
      recipientUserIds: recipients,
    });
  }

  logAudit({ userId: user.id, userName: user.username, userRole: user.role, action: 'EXAM_GRADES_SAVED', module: 'examinations', recordRef: String(examId), ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

// ─── HOMEWORK & SUBMISSIONS ──────────────────────────────────────────────────
router.get('/homework', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  if (user.role === 'student') {
    const list = db
      .prepare(
        `SELECT h.*, cl.name AS class_name, sub.name AS subject_name,
                t.first_name || ' ' || t.last_name AS teacher_name,
                hs.id AS submission_id, hs.response_text, hs.attachment_url AS submission_attachment_url,
                hs.attachment_name AS submission_attachment_name, hs.submitted_at, hs.is_late,
                hs.score, hs.feedback, hs.status AS submission_status
         FROM homework h
         JOIN classes cl ON cl.id = h.class_id
         JOIN subjects sub ON sub.id = h.subject_id
         JOIN teachers t ON t.id = h.teacher_id
         JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = ? AND e.status = 'active'
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = ?
         ORDER BY h.due_date DESC, h.id DESC`
      )
      .all(user.student_id || 0, user.student_id || 0);
    res.json({ homework: list });
    return;
  }

  let where = '';
  let params: any[] = [];
  if (user.role === 'teacher') {
    where = 'WHERE h.teacher_id = ?';
    params = [user.teacher_id || 0];
  }
  const list = db
    .prepare(
      `SELECT h.*, cl.name AS class_name, sub.name AS subject_name,
              t.first_name || ' ' || t.last_name AS teacher_name,
              (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id) AS submission_count
       FROM homework h
       JOIN classes cl ON cl.id = h.class_id
       JOIN subjects sub ON sub.id = h.subject_id
       JOIN teachers t ON t.id = h.teacher_id
       ${where}
       ORDER BY h.due_date DESC, h.id DESC`
    )
    .all(...params);
  res.json({ homework: list });
});

router.post('/homework', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const b = req.body || {};
  const classId = Number(b.class_id || 0);
  const subjectId = Number(b.subject_id || 0);
  const teacherId = user.role === 'teacher' ? Number(user.teacher_id) : Number(b.teacher_id || 0);

  if (!b.title || !classId || !subjectId || !teacherId || !b.due_date) {
    res.status(400).json({ error: 'Title, class, subject, teacher, and deadline are required.' });
    return;
  }
  if (user.role === 'teacher' && !isTeacherAssignedToClassSubject(teacherId, classId, subjectId)) {
    res.status(403).json({ error: 'You are not assigned to this class and subject.' });
    return;
  }

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO homework (title, description, class_id, subject_id, teacher_id, due_date, max_score, attachment_url, attachment_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title).trim(),
      String(b.description || ''),
      classId,
      subjectId,
      teacherId,
      String(b.due_date),
      Number(b.max_score || 100),
      String(b.attachment_url || ''),
      String(b.attachment_name || '')
    );

  const recipients = (
    db
      .prepare(`SELECT s.user_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.class_id = ? AND e.status = 'active'`)
      .all(classId) as Array<{ user_id: number }>
  ).map((r) => r.user_id);
  createNotification({
    title: `New Homework: ${String(b.title).trim()}`,
    message: `Assigned due date: ${String(b.due_date)}.`,
    type: 'homework',
    targetType: 'class',
    createdBy: user.id,
    recipientUserIds: recipients,
  });

  logAudit({ userId: user.id, userName: user.username, userRole: user.role, action: 'HOMEWORK_CREATED', module: 'homework', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.get('/homework/:id/submissions', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  const hwId = Number(req.params.id);
  const hw = db.prepare(`SELECT * FROM homework WHERE id = ?`).get(hwId) as any;
  if (!hw) {
    res.status(404).json({ error: 'Homework not found' });
    return;
  }
  if (req.authUser!.role === 'teacher' && hw.teacher_id !== req.authUser!.teacher_id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const submissions = db
    .prepare(
      `SELECT hs.*, s.student_code, s.first_name || ' ' || s.last_name AS student_name
       FROM homework_submissions hs
       JOIN students s ON s.id = hs.student_id
       WHERE hs.homework_id = ? ORDER BY hs.submitted_at DESC`
    )
    .all(hwId);
  res.json({ homework: hw, submissions });
});

router.post('/homework/:id/submit', requireRole('student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const hwId = Number(req.params.id);
  const studentId = req.authUser!.student_id || 0;
  const hw = db.prepare(`SELECT * FROM homework WHERE id = ?`).get(hwId) as any;
  if (!hw) {
    res.status(404).json({ error: 'Homework not found' });
    return;
  }
  const enrolled = db.prepare(`SELECT 1 FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'`).get(studentId, hw.class_id);
  if (!enrolled) {
    res.status(403).json({ error: 'You are not enrolled in this class.' });
    return;
  }

  const responseText = String(req.body?.response_text || '').trim();
  const attachmentUrl = String(req.body?.attachment_url || '');
  const attachmentName = String(req.body?.attachment_name || '');
  if (!responseText && !attachmentUrl) {
    res.status(400).json({ error: 'Please provide a written response or attach a file.' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const isLate = today > hw.due_date ? 1 : 0;

  db.prepare(
    `INSERT INTO homework_submissions (homework_id, student_id, response_text, attachment_url, attachment_name, submitted_at, is_late, status)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'submitted')
     ON CONFLICT(homework_id, student_id)
     DO UPDATE SET response_text = excluded.response_text, attachment_url = excluded.attachment_url, attachment_name = excluded.attachment_name, submitted_at = datetime('now'), is_late = excluded.is_late, status = 'submitted'`
  ).run(hwId, studentId, responseText, attachmentUrl, attachmentName, isLate);

  res.json({ ok: true, is_late: Boolean(isLate) });
});

router.post('/homework/submissions/:subId/grade', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  const subId = Number(req.params.subId);
  const sub = db.prepare(`SELECT hs.*, h.teacher_id, h.title, s.user_id AS student_user_id FROM homework_submissions hs JOIN homework h ON h.id = hs.homework_id JOIN students s ON s.id = hs.student_id WHERE hs.id = ?`).get(subId) as any;
  if (!sub) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }
  if (req.authUser!.role === 'teacher' && sub.teacher_id !== req.authUser!.teacher_id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const score = req.body?.score !== undefined && req.body?.score !== '' ? Number(req.body.score) : null;
  const feedback = String(req.body?.feedback || '');
  db.prepare(`UPDATE homework_submissions SET score = ?, feedback = ?, status = 'graded', graded_by = ?, graded_at = datetime('now') WHERE id = ?`).run(
    score,
    feedback,
    req.authUser!.id,
    subId
  );

  createNotification({
    title: `Homework Graded: ${sub.title}`,
    message: score !== null ? `Score: ${score}. ${feedback}` : feedback || 'Your submission has been reviewed.',
    type: 'homework',
    targetType: 'individual',
    createdBy: req.authUser!.id,
    recipientUserIds: [sub.student_user_id],
  });

  res.json({ ok: true });
});

export default router;
