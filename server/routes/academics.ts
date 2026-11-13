import { Router } from 'express';
import {
  createNotification,
  getDb,
  hashPassword,
  logAudit,
  runTransaction,
} from '../db/database';
import {
  type AuthedRequest,
  getClientIp,
  getTeacherAssignedClassIds,
  getTeacherAssignedStudentIds,
  requireAuth,
  requireRole,
} from '../middleware/auth';
import { formatCode, validateTimetableSlot, type TimetableSlot } from '../../src/utils/eduLogic';

const router = Router();
router.use(requireAuth);

// ─── STUDENTS ────────────────────────────────────────────────────────────────
router.get('/students', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;

  if (user.role === 'student') {
    const row = db.prepare(`SELECT s.*, u.username, u.status AS account_status FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(user.student_id || 0);
    res.json({ students: row ? [row] : [] });
    return;
  }

  let rows: any[] = [];
  if (user.role === 'teacher') {
    const ids = getTeacherAssignedStudentIds(user.teacher_id || 0);
    if (ids.length === 0) {
      res.json({ students: [] });
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    rows = db
      .prepare(
        `SELECT s.*, u.username, u.status AS account_status,
          (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS current_class,
          (SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS current_course
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.id IN (${placeholders})
         ORDER BY s.id DESC`
      )
      .all(...ids);
  } else {
    rows = db
      .prepare(
        `SELECT s.*, u.username, u.status AS account_status,
          (SELECT e.class_id FROM enrollments e WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS current_class_id,
          (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS current_class,
          (SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS current_course,
          COALESCE((SELECT SUM(total_amount - discount_amount - paid_amount) FROM student_fees sf WHERE sf.student_id = s.id), 0) AS balance_due
         FROM students s JOIN users u ON u.id = s.user_id
         ORDER BY s.id DESC`
      )
      .all();
  }
  res.json({ students: rows });
});

router.get('/students/:id/profile', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const studentId = Number(req.params.id);
  const user = req.authUser!;

  if (user.role === 'student' && user.student_id !== studentId) {
    res.status(403).json({ error: 'Cannot view another student profile.' });
    return;
  }
  if (user.role === 'teacher') {
    const allowed = getTeacherAssignedStudentIds(user.teacher_id || 0);
    if (!allowed.includes(studentId)) {
      res.status(403).json({ error: 'Student is not assigned to your classes.' });
      return;
    }
  }

  const student = db
    .prepare(`SELECT s.*, u.username, u.status AS account_status, u.preferred_lang FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(studentId);
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const enrollments = db
    .prepare(
      `SELECT e.*, cl.name AS class_name, cl.class_code, c.title AS course_title, c.course_code
       FROM enrollments e
       JOIN classes cl ON cl.id = e.class_id
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? ORDER BY e.id DESC`
    )
    .all(studentId);

  const attendance = db
    .prepare(
      `SELECT sa.*, cl.name AS class_name FROM student_attendance sa
       JOIN classes cl ON cl.id = sa.class_id
       WHERE sa.student_id = ? ORDER BY sa.attendance_date DESC LIMIT 100`
    )
    .all(studentId);

  const grades = db
    .prepare(
      `SELECT eg.*, ex.title AS exam_title, ex.exam_date, ex.max_score, ex.passing_score, ex.is_published, sub.name AS subject_name
       FROM exam_grades eg
       JOIN examinations ex ON ex.id = eg.exam_id
       JOIN subjects sub ON sub.id = ex.subject_id
       WHERE eg.student_id = ? ${user.role === 'student' ? 'AND ex.is_published = 1' : ''}
       ORDER BY ex.exam_date DESC`
    )
    .all(studentId);

  const homework = db
    .prepare(
      `SELECT hs.*, h.title AS homework_title, h.due_date, h.max_score, sub.name AS subject_name
       FROM homework_submissions hs
       JOIN homework h ON h.id = hs.homework_id
       JOIN subjects sub ON sub.id = h.subject_id
       WHERE hs.student_id = ? ORDER BY hs.submitted_at DESC`
    )
    .all(studentId);

  // Teachers cannot view student financial payment history
  const fees =
    user.role === 'teacher'
      ? []
      : db.prepare(`SELECT * FROM student_fees WHERE student_id = ? ORDER BY id DESC`).all(studentId);
  const payments =
    user.role === 'teacher'
      ? []
      : db.prepare(`SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, id DESC`).all(studentId);

  // Only admins can view certificates or ID cards
  const certificates =
    user.role !== 'admin'
      ? []
      : db
          .prepare(
            `SELECT cert.*, c.title AS course_title, cl.name AS class_name
             FROM certificates cert
             LEFT JOIN courses c ON c.id = cert.course_id
             LEFT JOIN classes cl ON cl.id = cert.class_id
             WHERE cert.student_id = ? ORDER BY cert.issue_date DESC`
          )
          .all(studentId);

  const idCards =
    user.role !== 'admin'
      ? []
      : db
          .prepare(
            `SELECT ic.*, t.name AS template_name FROM id_card_records ic
             JOIN id_card_templates t ON t.id = ic.template_id
             WHERE ic.student_id = ? ORDER BY ic.issue_date DESC`
          )
          .all(studentId);

  res.json({ student, enrollments, attendance, grades, homework, fees, payments, certificates, idCards });
});

router.post('/students', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const firstName = String(b.first_name || '').trim();
  const lastName = String(b.last_name || '').trim();
  const username = String(b.username || '').trim();
  const email = String(b.email || '').trim();
  const password = String(b.password || 'Student@2026');
  const classId = b.class_id ? Number(b.class_id) : null;

  if (!firstName || !lastName || !username || !email) {
    res.status(400).json({ error: 'First name, last name, username, and email are required.' });
    return;
  }

  try {
    const created = runTransaction((tx) => {
      const nextNumRow = tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM students`).get() as { nxt: number };
      const studentCode = b.student_code ? String(b.student_code).trim() : formatCode('STU', nextNumRow.nxt);
      const fullName = `${firstName} ${lastName}`;

      const uRes = tx
        .prepare(
          `INSERT INTO users (username, email, password_hash, role, full_name, phone, photo_url, preferred_lang, status)
           VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'active')`
        )
        .run(
          username,
          email,
          hashPassword(password),
          fullName,
          String(b.phone || ''),
          String(b.photo_url || ''),
          ['en', 'fa', 'ps', 'uz', 'tk'].includes(b.preferred_lang) ? b.preferred_lang : 'en'
        );

      const userId = Number(uRes.lastInsertRowid);
      const sRes = tx
        .prepare(
          `INSERT INTO students (user_id, student_code, first_name, last_name, father_name, gender, date_of_birth, national_id, phone, email, address, guardian_name, guardian_phone, guardian_relation, photo_url, admission_date, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          studentCode,
          firstName,
          lastName,
          String(b.father_name || ''),
          ['male', 'female', 'other'].includes(b.gender) ? b.gender : 'male',
          String(b.date_of_birth || ''),
          String(b.national_id || ''),
          String(b.phone || ''),
          email,
          String(b.address || ''),
          String(b.guardian_name || ''),
          String(b.guardian_phone || ''),
          String(b.guardian_relation || ''),
          String(b.photo_url || ''),
          String(b.admission_date || new Date().toISOString().slice(0, 10)),
          ['active', 'graduated', 'suspended', 'withdrawn'].includes(b.status) ? b.status : 'active',
          String(b.notes || '')
        );

      const studentId = Number(sRes.lastInsertRowid);

      // Optional immediate class enrollment + automatic tuition fee assignment
      if (classId) {
        const cls = tx.prepare(`SELECT id, course_id, capacity FROM classes WHERE id = ?`).get(classId) as
          | { id: number; course_id: number; capacity: number }
          | undefined;
        if (!cls) throw new Error('Selected class does not exist.');
        const activeEnrCount = (
          tx.prepare(`SELECT COUNT(*) AS cnt FROM enrollments WHERE class_id = ? AND status = 'active'`).get(classId) as { cnt: number }
        ).cnt;
        if (activeEnrCount >= cls.capacity) throw new Error('Selected class has reached maximum capacity.');

        const enRes = tx
          .prepare(`INSERT INTO enrollments (student_id, class_id, course_id, enrolled_at, status) VALUES (?, ?, ?, date('now'), 'active')`)
          .run(studentId, classId, cls.course_id);
        const enrollmentId = Number(enRes.lastInsertRowid);

        const course = tx.prepare(`SELECT title, fee_amount FROM courses WHERE id = ?`).get(cls.course_id) as { title: string; fee_amount: number };
        if (course && course.fee_amount > 0) {
          tx.prepare(
            `INSERT INTO student_fees (student_id, enrollment_id, title, total_amount, discount_amount, paid_amount, due_date, status)
             VALUES (?, ?, ?, ?, 0, 0, date('now', '+14 days'), 'unpaid')`
          ).run(studentId, enrollmentId, `${course.title} Tuition`, course.fee_amount);
        }
      }

      return { id: studentId, userId, studentCode };
    });

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'STUDENT_CREATED',
      module: 'students',
      recordRef: created.studentCode,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ ok: true, id: created.id, student_code: created.studentCode });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not create student (check unique username/email/code).' });
  }
});

router.put('/students/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM students WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  try {
    runTransaction((tx) => {
      const firstName = String(b.first_name ?? existing.first_name).trim();
      const lastName = String(b.last_name ?? existing.last_name).trim();
      const status = ['active', 'graduated', 'suspended', 'withdrawn'].includes(b.status) ? b.status : existing.status;

      const nextPhoto = b.photo_url !== undefined ? String(b.photo_url ?? '').trim() : existing.photo_url;
      tx.prepare(
        `UPDATE students SET first_name=?, last_name=?, father_name=?, gender=?, date_of_birth=?, national_id=?, phone=?, email=?, address=?, guardian_name=?, guardian_phone=?, guardian_relation=?, photo_url=?, status=?, notes=? WHERE id=?`
      ).run(
        firstName,
        lastName,
        String(b.father_name ?? existing.father_name),
        String(b.gender ?? existing.gender),
        String(b.date_of_birth ?? existing.date_of_birth),
        String(b.national_id ?? existing.national_id),
        String(b.phone ?? existing.phone),
        String(b.email ?? existing.email),
        String(b.address ?? existing.address),
        String(b.guardian_name ?? existing.guardian_name),
        String(b.guardian_phone ?? existing.guardian_phone),
        String(b.guardian_relation ?? existing.guardian_relation),
        nextPhoto,
        status,
        String(b.notes ?? existing.notes),
        id
      );

      tx.prepare(`UPDATE users SET full_name=?, phone=?, email=?, photo_url=?, status=?, updated_at=datetime('now') WHERE id=?`).run(
        `${firstName} ${lastName}`,
        String(b.phone ?? existing.phone),
        String(b.email ?? existing.email),
        nextPhoto,
        status === 'active' ? 'active' : 'inactive',
        existing.user_id
      );

      if (b.class_id && Number(b.class_id) > 0) {
        const classId = Number(b.class_id);
        const alreadyActive = tx.prepare(`SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active'`).get(id, classId);
        if (!alreadyActive) {
          const cls = tx.prepare(`SELECT id, course_id FROM classes WHERE id = ?`).get(classId) as { id: number; course_id: number } | undefined;
          if (cls) {
            tx.prepare(`INSERT INTO enrollments (student_id, class_id, course_id, enrolled_at, status) VALUES (?, ?, ?, date('now'), 'active')`).run(
              id,
              classId,
              cls.course_id
            );
          }
        }
      }
    });

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'STUDENT_UPDATED',
      module: 'students',
      recordRef: existing.student_code,
      ipAddress: getClientIp(req),
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update student.' });
  }
});

// ─── TEACHERS ────────────────────────────────────────────────────────────────
router.get('/teachers', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  if (req.authUser!.role === 'teacher') {
    const row = db
      .prepare(`SELECT t.*, u.username, u.status AS account_status FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`)
      .get(req.authUser!.teacher_id || 0);
    res.json({ teachers: row ? [row] : [] });
    return;
  }
  const teachers = db
    .prepare(
      `SELECT t.*, u.username, u.status AS account_status,
        (SELECT COUNT(DISTINCT cst.class_id) FROM class_subject_teachers cst WHERE cst.teacher_id = t.id) AS assigned_classes_count,
        (SELECT COUNT(DISTINCT cst.subject_id) FROM class_subject_teachers cst WHERE cst.teacher_id = t.id) AS assigned_subjects_count
       FROM teachers t JOIN users u ON u.id = t.user_id ORDER BY t.id DESC`
    )
    .all();
  res.json({ teachers });
});

router.get('/teachers/:id/profile', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const db = getDb();
  const teacherId = Number(req.params.id);
  const user = req.authUser!;

  if (user.role === 'teacher' && user.teacher_id !== teacherId) {
    res.status(403).json({ error: 'Cannot view another teacher profile.' });
    return;
  }

  const teacher = db
    .prepare(`SELECT t.*, u.username, u.status AS account_status, u.preferred_lang FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`)
    .get(teacherId);
  if (!teacher) {
    res.status(404).json({ error: 'Teacher not found' });
    return;
  }

  const assignments = db
    .prepare(
      `SELECT cst.id, cst.class_id, cst.subject_id, cl.name AS class_name, cl.class_code, cl.room, c.title AS course_title, s.name AS subject_name, s.subject_code
       FROM class_subject_teachers cst
       JOIN classes cl ON cl.id = cst.class_id
       JOIN courses c ON c.id = cl.course_id
       JOIN subjects s ON s.id = cst.subject_id
       WHERE cst.teacher_id = ?
       ORDER BY cl.id ASC, s.name ASC`
    )
    .all(teacherId);

  const timetable = db
    .prepare(
      `SELECT tt.*, cl.name AS class_name, cl.class_code, s.name AS subject_name
       FROM timetables tt
       JOIN classes cl ON cl.id = tt.class_id
       JOIN subjects s ON s.id = tt.subject_id
       WHERE tt.teacher_id = ?
       ORDER BY CASE tt.day_of_week
         WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
         WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6 ELSE 7 END,
       tt.start_time ASC`
    )
    .all(teacherId);

  const attendance = db
    .prepare(`SELECT * FROM teacher_attendance WHERE teacher_id = ? ORDER BY attendance_date DESC LIMIT 60`)
    .all(teacherId) as Array<{ status: string }>;

  const attendanceSummary = {
    present: attendance.filter((a) => a.status === 'present').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    late: attendance.filter((a) => a.status === 'late').length,
    excused: attendance.filter((a) => a.status === 'excused').length,
  };

  const salaryDefinition = db.prepare(`SELECT * FROM salary_definitions WHERE teacher_id = ?`).get(teacherId) || null;
  const salaryPayments = db
    .prepare(`SELECT * FROM salary_payments WHERE teacher_id = ? ORDER BY payment_date DESC, id DESC LIMIT 24`)
    .all(teacherId);

  res.json({ teacher, assignments, timetable, attendance, attendanceSummary, salaryDefinition, salaryPayments });
});

router.post('/teachers', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const firstName = String(b.first_name || '').trim();
  const lastName = String(b.last_name || '').trim();
  const username = String(b.username || '').trim();
  const email = String(b.email || '').trim();
  const password = String(b.password || 'Teacher@2026');
  if (!firstName || !lastName || !username || !email) {
    res.status(400).json({ error: 'First name, last name, username, and email are required.' });
    return;
  }

  try {
    const created = runTransaction((tx) => {
      const nextNum = (tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM teachers`).get() as { nxt: number }).nxt;
      const teacherCode = b.teacher_code ? String(b.teacher_code).trim() : formatCode('TCH', nextNum);

      const uRes = tx
        .prepare(
          `INSERT INTO users (username, email, password_hash, role, full_name, phone, photo_url, preferred_lang, status)
           VALUES (?, ?, ?, 'teacher', ?, ?, ?, ?, 'active')`
        )
        .run(
          username,
          email,
          hashPassword(password),
          `${firstName} ${lastName}`,
          String(b.phone || ''),
          String(b.photo_url || ''),
          ['en', 'fa', 'ps', 'uz', 'tk'].includes(b.preferred_lang) ? b.preferred_lang : 'en'
        );

      const userId = Number(uRes.lastInsertRowid);
      const tRes = tx
        .prepare(
          `INSERT INTO teachers (user_id, teacher_code, first_name, last_name, specialization, qualification, phone, email, address, photo_url, hire_date, base_salary, salary_type, status, bio, show_on_website, featured_on_home)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        )
        .run(
          userId,
          teacherCode,
          firstName,
          lastName,
          String(b.specialization || ''),
          String(b.qualification || ''),
          String(b.phone || ''),
          email,
          String(b.address || ''),
          String(b.photo_url || ''),
          String(b.hire_date || new Date().toISOString().slice(0, 10)),
          Number(b.base_salary || 0),
          ['monthly', 'hourly', 'per_class'].includes(b.salary_type) ? b.salary_type : 'monthly',
          String(b.bio || ''),
          b.show_on_website === false ? 0 : 1,
          b.featured_on_home ? 1 : 0
        );

      const teacherId = Number(tRes.lastInsertRowid);
      if (Number(b.base_salary || 0) > 0) {
        tx.prepare(
          `INSERT OR IGNORE INTO salary_definitions (teacher_id, base_amount, allowance, deduction, effective_from) VALUES (?, ?, 0, 0, date('now'))`
        ).run(teacherId, Number(b.base_salary));
      }
      return { id: teacherId, teacherCode };
    });

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'TEACHER_CREATED',
      module: 'teachers',
      recordRef: created.teacherCode,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ ok: true, id: created.id, teacher_code: created.teacherCode });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create teacher.' });
  }
});

router.put('/teachers/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM teachers WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Teacher not found' });
    return;
  }

  runTransaction((tx) => {
    const firstName = String(b.first_name ?? existing.first_name).trim();
    const lastName = String(b.last_name ?? existing.last_name).trim();
    const status = b.status === 'inactive' ? 'inactive' : 'active';
    const nextPhoto = b.photo_url !== undefined ? String(b.photo_url ?? '').trim() : existing.photo_url;
    tx.prepare(
      `UPDATE teachers SET first_name=?, last_name=?, specialization=?, qualification=?, phone=?, email=?, address=?, photo_url=?, base_salary=?, salary_type=?, status=?, bio=?, show_on_website=?, featured_on_home=? WHERE id=?`
    ).run(
      firstName,
      lastName,
      String(b.specialization ?? existing.specialization),
      String(b.qualification ?? existing.qualification),
      String(b.phone ?? existing.phone),
      String(b.email ?? existing.email),
      String(b.address ?? existing.address),
      nextPhoto,
      Number(b.base_salary ?? existing.base_salary),
      String(b.salary_type ?? existing.salary_type),
      status,
      String(b.bio ?? existing.bio),
      b.show_on_website === undefined ? existing.show_on_website : b.show_on_website ? 1 : 0,
      b.featured_on_home === undefined ? existing.featured_on_home : b.featured_on_home ? 1 : 0,
      id
    );
    tx.prepare(`UPDATE users SET full_name=?, phone=?, email=?, photo_url=?, status=?, updated_at=datetime('now') WHERE id=?`).run(
      `${firstName} ${lastName}`,
      String(b.phone ?? existing.phone),
      String(b.email ?? existing.email),
      nextPhoto,
      status,
      existing.user_id
    );
  });

  logAudit({
    userId: req.authUser!.id,
    userName: req.authUser!.username,
    userRole: 'admin',
    action: 'TEACHER_UPDATED',
    module: 'teachers',
    recordRef: existing.teacher_code,
    ipAddress: getClientIp(req),
  });
  res.json({ ok: true });
});

// ─── SUBJECTS, COURSES, CLASSES & ASSIGNMENTS ────────────────────────────────
router.get('/subjects', (_req, res) => {
  const db = getDb();
  res.json({ subjects: db.prepare(`SELECT * FROM subjects ORDER BY id DESC`).all() });
});

router.post('/subjects', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Subject name is required.' });
    return;
  }
  const nxt = (db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM subjects`).get() as { nxt: number }).nxt;
  const code = b.subject_code ? String(b.subject_code).trim() : formatCode('SUB', nxt);
  const info = db
    .prepare(`INSERT INTO subjects (subject_code, name, description, credit_hours, status) VALUES (?, ?, ?, ?, ?)`)
    .run(code, name, String(b.description || ''), Number(b.credit_hours || 3), b.status === 'inactive' ? 'inactive' : 'active');
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SUBJECT_CREATED', module: 'subjects', recordRef: code, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), subject_code: code });
});

router.put('/subjects/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const b = req.body || {};
  db.prepare(`UPDATE subjects SET name=?, description=?, credit_hours=?, status=? WHERE id=?`).run(
    String(b.name || '').trim(),
    String(b.description || ''),
    Number(b.credit_hours || 3),
    b.status === 'inactive' ? 'inactive' : 'active',
    Number(req.params.id)
  );
  res.json({ ok: true });
});

router.get('/courses', (_req, res) => {
  const db = getDb();
  const courses = db
    .prepare(
      `SELECT c.*,
        (SELECT GROUP_CONCAT(cs.subject_id) FROM course_subjects cs WHERE cs.course_id = c.id) AS subject_ids,
        (SELECT GROUP_CONCAT(s.name, ', ') FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.course_id = c.id) AS subject_names
       FROM courses c ORDER BY c.id DESC`
    )
    .all();
  res.json({ courses });
});

router.post('/courses', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) {
    res.status(400).json({ error: 'Course title is required.' });
    return;
  }
  const created = runTransaction((tx) => {
    const nxt = (tx.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM courses`).get() as { nxt: number }).nxt;
    const code = b.course_code ? String(b.course_code).trim() : formatCode('CRS', nxt);
    const info = tx
      .prepare(
        `INSERT INTO courses (course_code, title, description, duration_weeks, start_date, end_date, fee_amount, capacity, featured, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        title,
        String(b.description || ''),
        Number(b.duration_weeks || 12),
        String(b.start_date || ''),
        String(b.end_date || ''),
        Number(b.fee_amount || 0),
        Number(b.capacity || 30),
        b.featured ? 1 : 0,
        String(b.image_url || '/src/assets/images/hero_academy_campus_1794554062936.jpg'),
        ['active', 'upcoming', 'completed', 'inactive'].includes(b.status) ? b.status : 'active'
      );
    const courseId = Number(info.lastInsertRowid);
    if (Array.isArray(b.subject_ids)) {
      const ins = tx.prepare(`INSERT OR IGNORE INTO course_subjects (course_id, subject_id) VALUES (?, ?)`);
      for (const sid of b.subject_ids) ins.run(courseId, Number(sid));
    }
    return { id: courseId, code };
  });
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'COURSE_CREATED', module: 'courses', recordRef: created.code, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: created.id, course_code: created.code });
});

router.put('/courses/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  runTransaction((tx) => {
    tx.prepare(
      `UPDATE courses SET title=?, description=?, duration_weeks=?, start_date=?, end_date=?, fee_amount=?, capacity=?, featured=?, image_url=?, status=? WHERE id=?`
    ).run(
      String(b.title || '').trim(),
      String(b.description || ''),
      Number(b.duration_weeks || 12),
      String(b.start_date || ''),
      String(b.end_date || ''),
      Number(b.fee_amount || 0),
      Number(b.capacity || 30),
      b.featured ? 1 : 0,
      String(b.image_url || ''),
      ['active', 'upcoming', 'completed', 'inactive'].includes(b.status) ? b.status : 'active',
      id
    );
    if (Array.isArray(b.subject_ids)) {
      tx.prepare(`DELETE FROM course_subjects WHERE course_id = ?`).run(id);
      const ins = tx.prepare(`INSERT OR IGNORE INTO course_subjects (course_id, subject_id) VALUES (?, ?)`);
      for (const sid of b.subject_ids) ins.run(id, Number(sid));
    }
  });
  res.json({ ok: true });
});

router.get('/classes', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  let whereClause = '';
  let params: any[] = [];

  if (user.role === 'teacher') {
    const classIds = getTeacherAssignedClassIds(user.teacher_id || 0);
    if (classIds.length === 0) {
      res.json({ classes: [], assignments: [] });
      return;
    }
    whereClause = `WHERE cl.id IN (${classIds.map(() => '?').join(',')})`;
    params = classIds;
  } else if (user.role === 'student') {
    whereClause = `WHERE cl.id IN (SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active')`;
    params = [user.student_id || 0];
  }

  const classes = db
    .prepare(
      `SELECT cl.*, c.title AS course_title, c.course_code,
        (SELECT COUNT(*) FROM enrollments e WHERE e.class_id = cl.id AND e.status = 'active') AS enrolled_count
       FROM classes cl
       JOIN courses c ON c.id = cl.course_id
       ${whereClause}
       ORDER BY cl.id DESC`
    )
    .all(...params);

  const assignments = db
    .prepare(
      `SELECT cst.*, cl.name AS class_name, s.name AS subject_name, s.subject_code,
              t.first_name || ' ' || t.last_name AS teacher_name, t.teacher_code
       FROM class_subject_teachers cst
       JOIN classes cl ON cl.id = cst.class_id
       JOIN subjects s ON s.id = cst.subject_id
       JOIN teachers t ON t.id = cst.teacher_id
       ORDER BY cst.id DESC`
    )
    .all();

  res.json({ classes, assignments });
});

router.post('/classes', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const courseId = Number(b.course_id || 0);
  if (!name || !courseId) {
    res.status(400).json({ error: 'Class name and course are required.' });
    return;
  }
  const db = getDb();
  const nxt = (db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM classes`).get() as { nxt: number }).nxt;
  const code = b.class_code ? String(b.class_code).trim() : formatCode('CLS', nxt);
  const info = db
    .prepare(
      `INSERT INTO classes (class_code, name, level, course_id, capacity, room, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      code,
      name,
      String(b.level || ''),
      courseId,
      Number(b.capacity || 25),
      String(b.room || ''),
      String(b.start_date || ''),
      String(b.end_date || ''),
      ['active', 'completed', 'inactive'].includes(b.status) ? b.status : 'active'
    );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'CLASS_CREATED', module: 'classes', recordRef: code, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), class_code: code });
});

router.post('/classes/:id/assign-teacher', requireRole('admin'), (req: AuthedRequest, res) => {
  const classId = Number(req.params.id);
  const subjectId = Number(req.body?.subject_id || 0);
  const teacherId = Number(req.body?.teacher_id || 0);
  if (!classId || !subjectId || !teacherId) {
    res.status(400).json({ error: 'Class, subject, and teacher are required.' });
    return;
  }
  const db = getDb();
  try {
    db.prepare(`INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id) VALUES (?, ?, ?)`).run(classId, subjectId, teacherId);
    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'TEACHER_ASSIGNED',
      module: 'classes',
      recordRef: `class:${classId}-sub:${subjectId}-tch:${teacherId}`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(400).json({ error: 'This teacher-subject assignment already exists for this class.' });
  }
});

router.delete('/classes/assignments/:assignmentId', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM class_subject_teachers WHERE id = ?`).run(Number(req.params.assignmentId));
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'TEACHER_UNASSIGNED', module: 'classes', recordRef: req.params.assignmentId, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

// ─── TIMETABLES WITH CONFLICT DETECTION ──────────────────────────────────────
router.get('/timetables', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  let where = '';
  let params: any[] = [];

  if (user.role === 'teacher') {
    where = 'WHERE tt.teacher_id = ?';
    params = [user.teacher_id || 0];
  } else if (user.role === 'student') {
    where = `WHERE tt.class_id IN (SELECT class_id FROM enrollments WHERE student_id = ? AND status = 'active')`;
    params = [user.student_id || 0];
  } else if (req.query.class_id && Number(req.query.class_id) > 0) {
    where = 'WHERE tt.class_id = ?';
    params = [Number(req.query.class_id)];
  }

  const rows = db
    .prepare(
      `SELECT tt.*, cl.name AS class_name, cl.class_code, s.name AS subject_name, s.subject_code,
              t.first_name || ' ' || t.last_name AS teacher_name
       FROM timetables tt
       JOIN classes cl ON cl.id = tt.class_id
       JOIN subjects s ON s.id = tt.subject_id
       JOIN teachers t ON t.id = tt.teacher_id
       ${where}
       ORDER BY CASE tt.day_of_week
         WHEN 'Saturday' THEN 1 WHEN 'Sunday' THEN 2 WHEN 'Monday' THEN 3
         WHEN 'Tuesday' THEN 4 WHEN 'Wednesday' THEN 5 WHEN 'Thursday' THEN 6 ELSE 7 END,
       tt.start_time ASC`
    )
    .all(...params);
  res.json({ timetables: rows });
});

router.post('/timetables', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const candidate: TimetableSlot = {
    class_id: Number(b.class_id),
    subject_id: Number(b.subject_id),
    teacher_id: Number(b.teacher_id),
    day_of_week: String(b.day_of_week || ''),
    start_time: String(b.start_time || ''),
    end_time: String(b.end_time || ''),
  };

  const db = getDb();
  const existing = db.prepare(`SELECT id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time FROM timetables`).all() as unknown as TimetableSlot[];
  const check = validateTimetableSlot(candidate, existing);
  if (!check.valid) {
    const messages: Record<string, string> = {
      invalid_time_range: 'Start time must be earlier than end time (HH:MM).',
      class_conflict: 'Timetable conflict: this class already has an overlapping lesson at that time.',
      teacher_conflict: 'Timetable conflict: this teacher is already scheduled in another class at that time.',
    };
    res.status(409).json({ error: messages[check.errorCode || 'invalid_time_range'], errorCode: check.errorCode });
    return;
  }

  const info = db
    .prepare(`INSERT INTO timetables (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(candidate.class_id, candidate.subject_id, candidate.teacher_id, candidate.day_of_week, candidate.start_time, candidate.end_time, String(b.room || ''));

  // Notify affected class students & teacher
  const studentUsers = db
    .prepare(`SELECT s.user_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.class_id = ? AND e.status = 'active'`)
    .all(candidate.class_id) as Array<{ user_id: number }>;
  const teacherUser = db.prepare(`SELECT user_id FROM teachers WHERE id = ?`).get(candidate.teacher_id) as { user_id: number } | undefined;
  const recipients = [...studentUsers.map((u) => u.user_id), ...(teacherUser ? [teacherUser.user_id] : [])];
  createNotification({
    title: 'Timetable Updated',
    message: `New scheduled session on ${candidate.day_of_week} (${candidate.start_time} - ${candidate.end_time}).`,
    type: 'timetable',
    targetType: 'class',
    createdBy: req.authUser!.id,
    recipientUserIds: recipients,
  });

  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'TIMETABLE_CREATED', module: 'timetables', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/timetables/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const current = db.prepare(`SELECT * FROM timetables WHERE id = ?`).get(id) as any;
  if (!current) {
    res.status(404).json({ error: 'Timetable slot not found.' });
    return;
  }

  const b = req.body || {};
  const candidate: TimetableSlot = {
    id,
    class_id: Number(b.class_id ?? current.class_id),
    subject_id: Number(b.subject_id ?? current.subject_id),
    teacher_id: Number(b.teacher_id ?? current.teacher_id),
    day_of_week: String(b.day_of_week ?? current.day_of_week),
    start_time: String(b.start_time ?? current.start_time),
    end_time: String(b.end_time ?? current.end_time),
  };

  const existing = db.prepare(`SELECT id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time FROM timetables`).all() as unknown as TimetableSlot[];
  const check = validateTimetableSlot(candidate, existing);
  if (!check.valid) {
    const messages: Record<string, string> = {
      invalid_time_range: 'Start time must be earlier than end time (HH:MM).',
      class_conflict: 'Timetable conflict: this class already has an overlapping lesson at that time.',
      teacher_conflict: 'Timetable conflict: this teacher is already scheduled in another class at that time.',
    };
    res.status(409).json({ error: messages[check.errorCode || 'invalid_time_range'], errorCode: check.errorCode });
    return;
  }

  db.prepare(
    `UPDATE timetables SET class_id = ?, subject_id = ?, teacher_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?`
  ).run(candidate.class_id, candidate.subject_id, candidate.teacher_id, candidate.day_of_week, candidate.start_time, candidate.end_time, String(b.room ?? current.room ?? ''), id);

  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'TIMETABLE_UPDATED', module: 'timetables', recordRef: String(id), ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.delete('/timetables/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`DELETE FROM timetables WHERE id = ?`).run(Number(req.params.id));
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'TIMETABLE_DELETED', module: 'timetables', recordRef: req.params.id, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

// ─── STUDENT PROMOTION (PRESERVES HISTORY) ───────────────────────────────────
router.post('/promotions', requireRole('admin'), (req: AuthedRequest, res) => {
  const fromClassId = Number(req.body?.from_class_id || 0);
  const toClassId = Number(req.body?.to_class_id || 0);
  const studentIds: number[] = Array.isArray(req.body?.student_ids) ? req.body.student_ids.map(Number) : [];

  if (!fromClassId || !toClassId || fromClassId === toClassId || studentIds.length === 0) {
    res.status(400).json({ error: 'Valid source class, distinct target class, and at least one student are required.' });
    return;
  }

  try {
    const promotedCount = runTransaction((tx) => {
      const targetClass = tx.prepare(`SELECT id, course_id, capacity FROM classes WHERE id = ?`).get(toClassId) as
        | { id: number; course_id: number; capacity: number }
        | undefined;
      if (!targetClass) throw new Error('Target class not found.');

      const currentCount = (tx.prepare(`SELECT COUNT(*) AS cnt FROM enrollments WHERE class_id = ? AND status = 'active'`).get(toClassId) as { cnt: number }).cnt;
      if (currentCount + studentIds.length > targetClass.capacity) {
        throw new Error(`Target class capacity (${targetClass.capacity}) exceeded.`);
      }

      let count = 0;
      for (const sid of studentIds) {
        const oldEnrollment = tx
          .prepare(`SELECT id FROM enrollments WHERE student_id = ? AND class_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`)
          .get(sid, fromClassId) as { id: number } | undefined;
        if (!oldEnrollment) continue;

        // Mark historical enrollment as promoted without erasing it
        tx.prepare(`UPDATE enrollments SET status = 'promoted', promotion_date = date('now') WHERE id = ?`).run(oldEnrollment.id);

        // Insert new active enrollment linked to previous enrollment
        tx.prepare(
          `INSERT INTO enrollments (student_id, class_id, course_id, enrolled_at, promoted_from_enrollment_id, promotion_date, status)
           VALUES (?, ?, ?, date('now'), ?, date('now'), 'active')`
        ).run(sid, toClassId, targetClass.course_id, oldEnrollment.id);

        count++;
      }
      return count;
    });

    logAudit({
      userId: req.authUser!.id,
      userName: req.authUser!.username,
      userRole: 'admin',
      action: 'STUDENTS_PROMOTED',
      module: 'promotions',
      recordRef: `from:${fromClassId}->to:${toClassId}`,
      details: { count: promotedCount, studentIds },
      ipAddress: getClientIp(req),
    });

    res.json({ ok: true, promoted_count: promotedCount });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Promotion failed.' });
  }
});

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────
router.get('/documents', requireRole('admin', 'teacher', 'student'), (req: AuthedRequest, res) => {
  const db = getDb();
  const user = req.authUser!;
  let rows: any[] = [];
  if (user.role === 'admin') {
    rows = db
      .prepare(
        `SELECT d.*, u.full_name AS owner_name, up.full_name AS uploaded_by_name
         FROM documents d
         LEFT JOIN users u ON u.id = d.owner_user_id
         LEFT JOIN users up ON up.id = d.uploaded_by
         WHERE d.is_archived = 0 ORDER BY d.id DESC`
      )
      .all();
  } else if (user.role === 'teacher') {
    rows = db
      .prepare(
        `SELECT d.*, u.full_name AS owner_name FROM documents d LEFT JOIN users u ON u.id = d.owner_user_id
         WHERE d.is_archived = 0 AND (d.teacher_id = ? OR d.owner_user_id = ?) ORDER BY d.id DESC`
      )
      .all(user.teacher_id || 0, user.id);
  } else {
    rows = db
      .prepare(
        `SELECT d.*, u.full_name AS owner_name FROM documents d LEFT JOIN users u ON u.id = d.owner_user_id
         WHERE d.is_archived = 0 AND (d.student_id = ? OR d.owner_user_id = ?) ORDER BY d.id DESC`
      )
      .all(user.student_id || 0, user.id);
  }
  res.json({ documents: rows });
});

router.post('/documents', requireRole('admin', 'teacher'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || !b.file_path || !b.original_name) {
    res.status(400).json({ error: 'Title and uploaded file metadata are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO documents (title, category, owner_user_id, student_id, teacher_id, file_path, original_name, mime_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(b.title).trim(),
      String(b.category || 'general'),
      b.owner_user_id ? Number(b.owner_user_id) : null,
      b.student_id ? Number(b.student_id) : null,
      b.teacher_id ? Number(b.teacher_id) : req.authUser!.teacher_id || null,
      String(b.file_path),
      String(b.original_name),
      String(b.mime_type || 'application/octet-stream'),
      Number(b.file_size || 0),
      req.authUser!.id
    );
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.delete('/documents/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`UPDATE documents SET is_archived = 1 WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
