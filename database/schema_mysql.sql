-- Danesh Academy EMS — Complete MySQL 8.0+ Installation Schema
-- Safe non-destructive creation (creates database if not exists, never drops existing data)

CREATE DATABASE IF NOT EXISTS danesh_academy_ems
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE danesh_academy_ems;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','teacher','student') NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  photo_url VARCHAR(255) DEFAULT '',
  preferred_lang ENUM('en','fa','ps','uz','tk') NOT NULL DEFAULT 'en',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  student_code VARCHAR(40) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  father_name VARCHAR(120) DEFAULT '',
  gender ENUM('male','female','other') DEFAULT 'male',
  date_of_birth DATE NULL,
  national_id VARCHAR(60) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  email VARCHAR(160) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  guardian_name VARCHAR(120) DEFAULT '',
  guardian_phone VARCHAR(40) DEFAULT '',
  guardian_relation VARCHAR(60) DEFAULT '',
  photo_url VARCHAR(255) DEFAULT '',
  admission_date DATE NOT NULL,
  status ENUM('active','graduated','suspended','withdrawn') NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  teacher_code VARCHAR(40) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  specialization VARCHAR(160) NOT NULL DEFAULT '',
  qualification VARCHAR(160) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  email VARCHAR(160) DEFAULT '',
  address VARCHAR(255) DEFAULT '',
  photo_url VARCHAR(255) DEFAULT '',
  hire_date DATE NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  salary_type ENUM('monthly','hourly','per_class') NOT NULL DEFAULT 'monthly',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  bio TEXT,
  show_on_website TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  credit_hours INT NOT NULL DEFAULT 3,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  duration_weeks INT NOT NULL DEFAULT 12,
  start_date DATE NULL,
  end_date DATE NULL,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  capacity INT NOT NULL DEFAULT 30,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  image_url VARCHAR(255) DEFAULT '',
  status ENUM('active','upcoming','completed','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_subjects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_course_subject (course_id, subject_id),
  CONSTRAINT fk_cs_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS classes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  level VARCHAR(80) DEFAULT '',
  course_id BIGINT UNSIGNED NOT NULL,
  capacity INT NOT NULL DEFAULT 25,
  room VARCHAR(80) DEFAULT '',
  start_date DATE NULL,
  end_date DATE NULL,
  status ENUM('active','completed','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_classes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_subject_teachers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_cst (class_id, subject_id, teacher_id),
  CONSTRAINT fk_cst_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cst_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cst_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  enrolled_at DATE NOT NULL,
  promoted_from_enrollment_id BIGINT UNSIGNED NULL,
  promotion_date DATE NULL,
  status ENUM('active','promoted','completed','dropped') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_enr_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  CONSTRAINT fk_enr_prev FOREIGN KEY (promoted_from_enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS timetables (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  day_of_week ENUM('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday') NOT NULL,
  start_time CHAR(5) NOT NULL,
  end_time CHAR(5) NOT NULL,
  room VARCHAR(80) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tt_class_day (class_id, day_of_week),
  KEY idx_tt_teacher_day (teacher_id, day_of_week),
  CONSTRAINT fk_tt_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tt_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  session_label VARCHAR(40) NOT NULL DEFAULT 'Morning',
  status ENUM('present','absent','late','excused') NOT NULL,
  remarks VARCHAR(255) DEFAULT '',
  recorded_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_stu_att (class_id, student_id, attendance_date, session_label),
  CONSTRAINT fk_sa_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present','absent','late','excused') NOT NULL,
  check_in_time VARCHAR(10) DEFAULT '',
  check_out_time VARCHAR(10) DEFAULT '',
  remarks VARCHAR(255) DEFAULT '',
  recorded_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_tch_att (teacher_id, attendance_date),
  CONSTRAINT fk_ta_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grading_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grade_letter VARCHAR(10) NOT NULL,
  min_percent DECIMAL(5,2) NOT NULL,
  max_percent DECIMAL(5,2) NOT NULL,
  gpa_points DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(80) DEFAULT '',
  is_passing TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS examinations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  exam_type VARCHAR(60) NOT NULL DEFAULT 'midterm',
  class_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  exam_date DATE NOT NULL,
  max_score DECIMAL(8,2) NOT NULL DEFAULT 100.00,
  passing_score DECIMAL(8,2) NOT NULL DEFAULT 50.00,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ex_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ex_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exam_grades (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exam_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(8,2) NOT NULL,
  feedback TEXT,
  graded_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_grade (exam_id, student_id),
  CONSTRAINT fk_eg_exam FOREIGN KEY (exam_id) REFERENCES examinations(id) ON DELETE CASCADE,
  CONSTRAINT fk_eg_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homework (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  class_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  max_score DECIMAL(8,2) NOT NULL DEFAULT 100.00,
  attachment_url VARCHAR(255) DEFAULT '',
  attachment_name VARCHAR(180) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hw_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_hw_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_hw_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homework_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  homework_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  response_text TEXT,
  attachment_url VARCHAR(255) DEFAULT '',
  attachment_name VARCHAR(180) DEFAULT '',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_late TINYINT(1) NOT NULL DEFAULT 0,
  score DECIMAL(8,2) NULL,
  feedback TEXT,
  status ENUM('submitted','graded','returned') NOT NULL DEFAULT 'submitted',
  graded_by BIGINT UNSIGNED NULL,
  graded_at DATETIME NULL,
  UNIQUE KEY uq_hw_sub (homework_id, student_id),
  CONSTRAINT fk_hs_hw FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
  CONSTRAINT fk_hs_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fee_definitions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  fee_type ENUM('tuition','registration','exam','material','other') NOT NULL DEFAULT 'tuition',
  description TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_fd_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_fees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NULL,
  fee_definition_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_date DATE NULL,
  status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sf_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(60) NOT NULL UNIQUE,
  student_fee_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method ENUM('cash','bank','card','transfer') NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL,
  idempotency_key VARCHAR(80) UNIQUE,
  notes TEXT,
  received_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_sf FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS income_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  income_date DATE NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  description TEXT,
  attachment_url VARCHAR(255) DEFAULT '',
  recorded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expense_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  attachment_url VARCHAR(255) DEFAULT '',
  recorded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salary_definitions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL UNIQUE,
  base_amount DECIMAL(12,2) NOT NULL,
  allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  deduction DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  effective_from DATE NOT NULL,
  notes TEXT,
  CONSTRAINT fk_sd_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS salary_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL,
  pay_month CHAR(7) NOT NULL,
  gross_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL,
  remaining_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'bank',
  notes TEXT,
  paid_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sp_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS id_card_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  orientation ENUM('landscape','portrait') NOT NULL DEFAULT 'landscape',
  width_mm DECIMAL(6,2) NOT NULL DEFAULT 85.60,
  height_mm DECIMAL(6,2) NOT NULL DEFAULT 54.00,
  bg_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#1e3a8a',
  text_color VARCHAR(20) NOT NULL DEFAULT '#0f172a',
  bg_image_url VARCHAR(255) DEFAULT '',
  logo_url VARCHAR(255) DEFAULT '',
  layout_json JSON NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS id_card_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  card_number VARCHAR(60) NOT NULL UNIQUE,
  student_id BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NULL,
  status ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  issued_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ic_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_ic_template FOREIGN KEY (template_id) REFERENCES id_card_templates(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificate_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  paper_size ENUM('A4','Letter') NOT NULL DEFAULT 'A4',
  orientation ENUM('landscape','portrait') NOT NULL DEFAULT 'landscape',
  bg_color VARCHAR(20) NOT NULL DEFAULT '#fffdf7',
  border_color VARCHAR(20) NOT NULL DEFAULT '#b45309',
  accent_color VARCHAR(20) NOT NULL DEFAULT '#1e3a8a',
  bg_image_url VARCHAR(255) DEFAULT '',
  logo_url VARCHAR(255) DEFAULT '',
  seal_text VARCHAR(120) NOT NULL,
  signature_left_label VARCHAR(120) NOT NULL,
  signature_right_label VARCHAR(120) NOT NULL,
  body_template TEXT NOT NULL,
  layout_json JSON NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  certificate_number VARCHAR(60) NOT NULL UNIQUE,
  student_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NULL,
  class_id BIGINT UNSIGNED NULL,
  template_id BIGINT UNSIGNED NOT NULL,
  issue_date DATE NOT NULL,
  grade_summary VARCHAR(80) DEFAULT '',
  remarks TEXT,
  issued_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cert_issue (student_id, course_id, template_id),
  CONSTRAINT fk_cert_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_template FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info','homework','exam','finance','timetable','system') NOT NULL DEFAULT 'info',
  target_type VARCHAR(40) NOT NULL DEFAULT 'individual',
  link_url VARCHAR(255) DEFAULT '',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_recipients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  UNIQUE KEY uq_nr (notification_id, user_id),
  CONSTRAINT fk_nr_notif FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(180) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_cp (conversation_id, user_id),
  CONSTRAINT fk_cp_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  attachment_url VARCHAR(255) DEFAULT '',
  attachment_name VARCHAR(180) DEFAULT '',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'general',
  owner_user_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NULL,
  teacher_id BIGINT UNSIGNED NULL,
  file_path VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_sliders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  subtitle TEXT,
  button_label VARCHAR(80) DEFAULT '',
  button_url VARCHAR(255) DEFAULT '',
  image_url VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_sections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  section_key VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(180) DEFAULT '',
  content_html MEDIUMTEXT,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1,
  meta_json JSON NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_pages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  content_html MEDIUMTEXT NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_menus (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  url VARCHAR(255) NOT NULL,
  target_page_slug VARCHAR(120) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 1,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  is_essential TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gallery_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gallery_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  media_type ENUM('image','video') NOT NULL DEFAULT 'image',
  file_url VARCHAR(255) NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gm_cat FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS featured_students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL UNIQUE,
  achievement_title VARCHAR(180) NOT NULL,
  achievement_detail TEXT,
  display_photo_url VARCHAR(255) DEFAULT '',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_fs_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS website_settings (`key` VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS system_settings (`key` VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  user_name VARCHAR(80) DEFAULT '',
  user_role VARCHAR(30) DEFAULT '',
  action VARCHAR(80) NOT NULL,
  module VARCHAR(60) NOT NULL,
  record_ref VARCHAR(120) DEFAULT '',
  result VARCHAR(20) NOT NULL DEFAULT 'success',
  details_json JSON NULL,
  ip_address VARCHAR(60) DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reminder_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  schedule_cron VARCHAR(60) NOT NULL DEFAULT '0 8 * * *',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  days_before INT NOT NULL DEFAULT 2,
  last_run_at DATETIME NULL,
  last_run_count INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS backup_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(180) NOT NULL UNIQUE,
  file_size BIGINT UNSIGNED NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  backup_type ENUM('manual','scheduled') NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
