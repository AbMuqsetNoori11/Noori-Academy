import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const DB_DIR = path.join(STORAGE_DIR, 'database');
export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const PUBLIC_MEDIA_DIR = path.join(STORAGE_DIR, 'public_media');
export const BACKUPS_DIR = path.join(STORAGE_DIR, 'backups');
export const DB_PATH = path.join(DB_DIR, 'academy.sqlite');

for (const dir of [STORAGE_DIR, DB_DIR, UPLOADS_DIR, PUBLIC_MEDIA_DIR, BACKUPS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

export function resetDbConnection(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function runTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback failure if already closed
    }
    throw err;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function logAudit(params: {
  userId?: number | null;
  userName?: string;
  userRole?: string;
  action: string;
  module: string;
  recordRef?: string;
  result?: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_ref, result, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      params.userId ?? null,
      params.userName ?? 'system',
      params.userRole ?? 'system',
      params.action,
      params.module,
      params.recordRef ?? null,
      params.result ?? 'success',
      params.details ? JSON.stringify(params.details) : null,
      params.ipAddress ?? '127.0.0.1'
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

export function createNotification(params: {
  title: string;
  message: string;
  type?: 'info' | 'homework' | 'exam' | 'finance' | 'timetable' | 'system';
  targetType: string;
  linkUrl?: string;
  createdBy?: number | null;
  recipientUserIds: number[];
}): number {
  const db = getDb();
  const uniqueIds = [...new Set(params.recipientUserIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (uniqueIds.length === 0) return 0;

  const info = db
    .prepare(
      `INSERT INTO notifications (title, message, type, target_type, link_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.title,
      params.message,
      params.type ?? 'info',
      params.targetType,
      params.linkUrl ?? null,
      params.createdBy ?? null
    );

  const notificationId = Number(info.lastInsertRowid);
  const insertRecipient = db.prepare(
    `INSERT OR IGNORE INTO notification_recipients (notification_id, user_id, is_read) VALUES (?, ?, 0)`
  );
  for (const uid of uniqueIds) {
    insertRecipient.run(notificationId, uid);
  }
  return notificationId;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK(preferred_lang IN ('en','fa','ps','uz','tk')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT DEFAULT NULL,
      last_login_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      csrf_token TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      success INTEGER NOT NULL DEFAULT 0,
      attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
      resolved_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT DEFAULT NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      student_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      father_name TEXT DEFAULT '',
      gender TEXT DEFAULT 'male' CHECK(gender IN ('male','female','other')),
      date_of_birth TEXT DEFAULT '',
      national_id TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      guardian_name TEXT DEFAULT '',
      guardian_phone TEXT DEFAULT '',
      guardian_relation TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      admission_date TEXT NOT NULL DEFAULT (date('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','graduated','suspended','withdrawn')),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      teacher_code TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      specialization TEXT NOT NULL DEFAULT '',
      qualification TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      hire_date TEXT NOT NULL DEFAULT (date('now')),
      base_salary REAL NOT NULL DEFAULT 0,
      salary_type TEXT NOT NULL DEFAULT 'monthly' CHECK(salary_type IN ('monthly','hourly','per_class')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      bio TEXT DEFAULT '',
      show_on_website INTEGER NOT NULL DEFAULT 1,
      featured_on_home INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      credit_hours INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      duration_weeks INTEGER NOT NULL DEFAULT 12,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      fee_amount REAL NOT NULL DEFAULT 0,
      capacity INTEGER NOT NULL DEFAULT 30,
      featured INTEGER NOT NULL DEFAULT 0,
      image_url TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','upcoming','completed','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS course_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      UNIQUE(course_id, subject_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      level TEXT DEFAULT '',
      course_id INTEGER NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 25,
      room TEXT DEFAULT '',
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS class_subject_teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      UNIQUE(class_id, subject_id, teacher_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at TEXT NOT NULL DEFAULT (date('now')),
      promoted_from_enrollment_id INTEGER DEFAULT NULL,
      promotion_date TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','promoted','completed','dropped')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
      FOREIGN KEY (promoted_from_enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS timetables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      attendance_date TEXT NOT NULL,
      session_label TEXT NOT NULL DEFAULT 'Morning',
      status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
      remarks TEXT DEFAULT '',
      recorded_by INTEGER DEFAULT NULL,
      updated_by INTEGER DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, student_id, attendance_date, session_label),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      attendance_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
      check_in_time TEXT DEFAULT '',
      check_out_time TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      recorded_by INTEGER DEFAULT NULL,
      UNIQUE(teacher_id, attendance_date),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS grading_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade_letter TEXT NOT NULL,
      min_percent REAL NOT NULL,
      max_percent REAL NOT NULL,
      gpa_points REAL NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      is_passing INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS examinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      exam_type TEXT NOT NULL DEFAULT 'midterm',
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      exam_date TEXT NOT NULL,
      max_score REAL NOT NULL DEFAULT 100,
      passing_score REAL NOT NULL DEFAULT 50,
      is_published INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exam_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      score REAL NOT NULL,
      feedback TEXT DEFAULT '',
      graded_by INTEGER DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(exam_id, student_id),
      FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      class_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      max_score REAL NOT NULL DEFAULT 100,
      attachment_url TEXT DEFAULT '',
      attachment_name TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      response_text TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      attachment_name TEXT DEFAULT '',
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_late INTEGER NOT NULL DEFAULT 0,
      score REAL DEFAULT NULL,
      feedback TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','graded','returned')),
      graded_by INTEGER DEFAULT NULL,
      graded_at TEXT DEFAULT NULL,
      UNIQUE(homework_id, student_id),
      FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS fee_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      course_id INTEGER DEFAULT NULL,
      amount REAL NOT NULL,
      fee_type TEXT NOT NULL DEFAULT 'tuition' CHECK(fee_type IN ('tuition','registration','exam','material','other')),
      description TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS student_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      enrollment_id INTEGER DEFAULT NULL,
      fee_definition_id INTEGER DEFAULT NULL,
      title TEXT NOT NULL,
      total_amount REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      due_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
      FOREIGN KEY (fee_definition_id) REFERENCES fee_definitions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      student_fee_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','card','transfer')),
      payment_date TEXT NOT NULL DEFAULT (date('now')),
      idempotency_key TEXT UNIQUE,
      notes TEXT DEFAULT '',
      received_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE RESTRICT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS income_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      income_date TEXT NOT NULL DEFAULT (date('now')),
      payment_id INTEGER DEFAULT NULL,
      description TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      recorded_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expense_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL DEFAULT (date('now')),
      description TEXT DEFAULT '',
      attachment_url TEXT DEFAULT '',
      recorded_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS salary_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL UNIQUE,
      base_amount REAL NOT NULL,
      allowance REAL NOT NULL DEFAULT 0,
      deduction REAL NOT NULL DEFAULT 0,
      effective_from TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      pay_month TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      remaining_balance REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL DEFAULT (date('now')),
      payment_method TEXT NOT NULL DEFAULT 'bank',
      notes TEXT DEFAULT '',
      paid_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
      FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS id_card_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      orientation TEXT NOT NULL DEFAULT 'landscape' CHECK(orientation IN ('landscape','portrait')),
      width_mm REAL NOT NULL DEFAULT 85.6,
      height_mm REAL NOT NULL DEFAULT 54,
      bg_color TEXT NOT NULL DEFAULT '#ffffff',
      accent_color TEXT NOT NULL DEFAULT '#1d4ed8',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      bg_image_url TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      layout_json TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS id_card_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      issue_date TEXT NOT NULL DEFAULT (date('now')),
      expiry_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired')),
      issued_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES id_card_templates(id) ON DELETE RESTRICT,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS certificate_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      paper_size TEXT NOT NULL DEFAULT 'A4' CHECK(paper_size IN ('A4','Letter')),
      orientation TEXT NOT NULL DEFAULT 'landscape' CHECK(orientation IN ('landscape','portrait')),
      bg_color TEXT NOT NULL DEFAULT '#fffdf7',
      border_color TEXT NOT NULL DEFAULT '#b45309',
      accent_color TEXT NOT NULL DEFAULT '#1e3a8a',
      bg_image_url TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      seal_text TEXT NOT NULL DEFAULT '',
      signature_left_label TEXT NOT NULL DEFAULT 'Academic Director',
      signature_right_label TEXT NOT NULL DEFAULT 'Center Principal',
      body_template TEXT NOT NULL,
      layout_json TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_number TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL,
      course_id INTEGER DEFAULT NULL,
      class_id INTEGER DEFAULT NULL,
      template_id INTEGER NOT NULL,
      issue_date TEXT NOT NULL DEFAULT (date('now')),
      grade_summary TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      issued_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, course_id, template_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE RESTRICT,
      FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info','homework','exam','finance','timetable','system')),
      target_type TEXT NOT NULL DEFAULT 'individual',
      link_url TEXT DEFAULT '',
      created_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notification_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT DEFAULT NULL,
      UNIQUE(notification_id, user_id),
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL DEFAULT 'Direct Message',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      attachment_url TEXT DEFAULT '',
      attachment_name TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      owner_user_id INTEGER DEFAULT NULL,
      student_id INTEGER DEFAULT NULL,
      teacher_id INTEGER DEFAULT NULL,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS website_sliders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      button_label TEXT DEFAULT '',
      button_url TEXT DEFAULT '',
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS website_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      content_html TEXT DEFAULT '',
      is_visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      meta_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS website_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content_html TEXT NOT NULL DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      is_system INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS website_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      target_page_slug TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_visible INTEGER NOT NULL DEFAULT 1,
      is_essential INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gallery_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS gallery_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      media_type TEXT NOT NULL DEFAULT 'image' CHECK(media_type IN ('image','video')),
      file_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS featured_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL UNIQUE,
      achievement_title TEXT NOT NULL,
      achievement_detail TEXT DEFAULT '',
      display_photo_url TEXT DEFAULT '',
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS website_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT NULL,
      user_name TEXT DEFAULT '',
      user_role TEXT DEFAULT '',
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_ref TEXT DEFAULT '',
      result TEXT NOT NULL DEFAULT 'success',
      details_json TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminder_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      schedule_cron TEXT NOT NULL DEFAULT '0 8 * * *',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      days_before INTEGER NOT NULL DEFAULT 2,
      last_run_at TEXT DEFAULT NULL,
      last_run_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reminder_sent_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      target_entity_type TEXT NOT NULL,
      target_entity_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      sent_on_date TEXT NOT NULL,
      UNIQUE(job_type, target_entity_type, target_entity_id, user_id, sent_on_date)
    );

    CREATE TABLE IF NOT EXISTS backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      file_size INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      backup_type TEXT NOT NULL DEFAULT 'manual' CHECK(backup_type IN ('manual','scheduled')),
      notes TEXT DEFAULT '',
      created_by INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id, status);
    CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id, status);
    CREATE INDEX IF NOT EXISTS idx_timetables_class_day ON timetables(class_id, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_timetables_teacher_day ON timetables(teacher_id, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_student_att_date ON student_attendance(class_id, attendance_date);
    CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id, status);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id, payment_date);
    CREATE INDEX IF NOT EXISTS idx_notif_recip_user ON notification_recipients(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
  `);

  // Safe idempotent column migrations for existing databases
  const teacherCols = db.prepare(`PRAGMA table_info(teachers)`).all() as Array<{ name: string }>;
  if (!teacherCols.some((c) => c.name === 'featured_on_home')) {
    db.exec(`ALTER TABLE teachers ADD COLUMN featured_on_home INTEGER NOT NULL DEFAULT 0;`);
  }
}
