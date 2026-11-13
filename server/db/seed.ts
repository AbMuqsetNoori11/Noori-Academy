import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getDb, hashPassword, runTransaction, UPLOADS_DIR } from './database';
import { computeFeeSummary } from '../../src/utils/eduLogic';

const SEED_VERSION = '2.0-dari-10x';

export function seedDatabaseIfEmpty(): void {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  runTransaction((tx) => {
    insertDariSeedData(tx);
  });
}

export function syncDariDemoDatabase(): void {
  const db = getDb();
  const verRow = db
    .prepare(`SELECT value FROM system_settings WHERE key = 'seed_version'`)
    .get() as { value: string } | undefined;

  if (verRow?.value === SEED_VERSION) {
    ensureSeedUploadFiles();
    applyPublicCmsV2Migration(db);
    applyEmsV3Migration(db);
    return;
  }

  runTransaction((tx) => {
    // Preserve any existing backup metadata without dangling user FK
    tx.prepare(`UPDATE backup_records SET created_by = NULL`).run();

    // Clear demo tables in strict bottom-up foreign-key dependency order
    const clearOrder = [
      'reminder_sent_log',
      'reminder_jobs',
      'audit_logs',
      'login_attempts',
      'password_reset_requests',
      'sessions',
      'featured_students',
      'gallery_media',
      'gallery_categories',
      'website_menus',
      'website_pages',
      'website_sections',
      'website_sliders',
      'website_settings',
      'system_settings',
      'documents',
      'messages',
      'conversation_participants',
      'conversations',
      'notification_recipients',
      'notifications',
      'certificates',
      'certificate_templates',
      'id_card_records',
      'id_card_templates',
      'salary_payments',
      'salary_definitions',
      'expense_records',
      'income_records',
      'payments',
      'student_fees',
      'fee_definitions',
      'homework_submissions',
      'homework',
      'exam_grades',
      'examinations',
      'grading_rules',
      'teacher_attendance',
      'student_attendance',
      'timetables',
      'enrollments',
      'class_subject_teachers',
      'classes',
      'course_subjects',
      'courses',
      'subjects',
      'students',
      'teachers',
      'users',
    ];

    for (const table of clearOrder) {
      tx.exec(`DELETE FROM ${table};`);
    }
    tx.exec(`DELETE FROM sqlite_sequence WHERE name != 'backup_records';`);

    insertDariSeedData(tx);
  });
}

function ensureSeedUploadFiles(): string[] {
  const sampleFiles: Array<{ filename: string; content: string }> = [
    {
      filename: 'seed-syllabus-web.txt',
      content: 'آکادمی دانش - نصاب درسی کورس مهندسی ویب و سیستم‌های معلوماتی\nبخش اول: مبانی شبکه و HTML/CSS\nبخش دوم: تایپ‌اسکریپت و ری‌اکت\nبخش سوم: دیتابیس رابطه‌ای SQL و امنیت API\n',
    },
    {
      filename: 'seed-policy-attendance.txt',
      content: 'مقرره حاضری و نظم اکادمیک آکادمی دانش\nحداقل حاضری مجاز برای شرکت در امتحان نهایی ۸۰ درصد است.\nتاخیر بیش از ۱۵ دقیقه در سیستم حاضری ثبت می‌گردد.\n',
    },
    {
      filename: 'seed-guide-ielts.txt',
      content: 'رهنمای آمادگی امتحان آیلتس - آکادمی دانش\nساختار مقاله اکادمیک، مهارت شنیداری، خوانش متون علمی و تمرین مصاحبه.\n',
    },
    {
      filename: 'seed-manual-python.txt',
      content: 'رهنمای عملی برنامه‌نویسی پایتون و ساختار داده‌ها\nشامل تمرین‌های الگوریتمی هفته اول تا دوازدهم.\n',
    },
    {
      filename: 'seed-handbook-student.txt',
      content: 'کتیبه‌چه رهنمای شاگردان آکادمی دانش\nقوانین لابراتوار کمپیوتر، زمان‌بندی پرداخت فیس و استفاده از پورتال شاگردان.\n',
    },
    {
      filename: 'seed-exam-rules.txt',
      content: 'لایحه امتحانات میان‌سمستر و نهایی\nنمره کامیابی ۵۰ درصد و سیستم درجه‌بندی از A+ تا F می‌باشد.\n',
    },
    {
      filename: 'seed-finance-guide.txt',
      content: 'طرزالعمل پرداخت فیس ماهانه و صدور رسید رسمی\nتمامی پرداخت‌ها در دفتر مالی ثبت و رسید چاپی صادر می‌شود.\n',
    },
    {
      filename: 'seed-network-lab.txt',
      content: 'سناریوی عملی لابراتوار شبکه‌های کمپیوتری\nپیکربندی روتر، سوییچ، VLAN و مفاهیم امنیت شبکه.\n',
    },
    {
      filename: 'seed-math-workbook.txt',
      content: 'مجموعه تمرین‌های ریاضیات گسسته و جبر خطی\nماتریس‌ها، گراف‌ها، منطق ریاضی و شمارش ترکیبی.\n',
    },
    {
      filename: 'seed-calendar-2026.txt',
      content: 'تقویم اکادمیک سال ۱۴۰۵ / ۲۰۲۶ آکادمی دانش\nآغاز دوره‌های بهاری، تاریخ امتحانات میان‌سمستر و جشن فراغت سالانه.\n',
    },
  ];

  for (const f of sampleFiles) {
    const target = path.join(UPLOADS_DIR, f.filename);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, f.content, 'utf8');
    }
  }
  return sampleFiles.map((f) => f.filename);
}

function insertDariSeedData(tx: DatabaseSync): void {
  const adminHash = hashPassword('Admin@2026');
  const teacherHash = hashPassword('Teacher@2026');
  const studentHash = hashPassword('Student@2026');

  const insertUser = tx.prepare(
    `INSERT INTO users (username, email, password_hash, role, full_name, phone, photo_url, preferred_lang, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'fa', 'active')`
  );

  // 1 Admin
  const adminId = Number(
    insertUser.run('admin', 'admin@danesh.edu', adminHash, 'admin', 'عبدالمقسط نوری', '+93 700 100 001', '').lastInsertRowid
  );

  // 10 Teachers
  const teacherSeed = [
    {
      username: 'teacher1',
      email: 'tariq.ahmadi@danesh.edu',
      first: 'استاد طارق',
      last: 'احمدی',
      spec: 'مهندسی نرم‌افزار و معماری سیستم‌ها',
      qual: 'ماستری علوم کمپیوتر',
      phone: '+93 700 200 101',
      addr: 'کارته چهار، ناحیه ۳، کابل',
      photo: '/src/assets/images/teacher_portrait_one_1794554063169.jpg',
      hire: '2024-03-01',
      salary: 950,
      bio: 'دوازده سال تجربه تدریس و رهبری نصاب در مهندسی ویب، دیتابیس‌های رابطه‌ای و علوم کمپیوتر کاربردی.',
    },
    {
      username: 'teacher2',
      email: 'maryam.sadat@danesh.edu',
      first: 'دوکتور مریم',
      last: 'سادات',
      spec: 'ریاضیات کاربردی و زبان انگلیسی اکادمیک',
      qual: 'دکتورای زبان‌شناسی کاربردی',
      phone: '+93 700 200 102',
      addr: 'شهر نو، ناحیه ۱۰، کابل',
      photo: '/src/assets/images/teacher_portrait_two_1794554063868.jpg',
      hire: '2024-04-15',
      salary: 1100,
      bio: 'متخصص آمادگی آیلتس، نگارش علمی و روش‌های تحلیلی ریاضی برای داوطلبان پوهنتون‌های بین‌المللی.',
    },
    {
      username: 'teacher3',
      email: 'farhad.nazari@danesh.edu',
      first: 'استاد فرهاد',
      last: 'نظری',
      spec: 'شبکه‌های کمپیوتری و امنیت سایبری',
      qual: 'ماستری امنیت شبکه‌ها',
      phone: '+93 700 200 103',
      addr: 'مکروریان سوم، کابل',
      photo: '/src/assets/images/teacher_portrait_one_1794554063169.jpg',
      hire: '2024-05-10',
      salary: 900,
      bio: 'مدرس لابراتوارهای شبکه‌سازی سیسکو، لینوکس سرور و مدیریت زیرساخت‌های معلوماتی.',
    },
    {
      username: 'teacher4',
      email: 'sahra.wardak@danesh.edu',
      first: 'استاد صحرا',
      last: 'وردک',
      spec: 'برنامه‌نویسی پایتون و تحلیل داده',
      qual: 'ماستری هوش مصنوعی و علم داده',
      phone: '+93 700 200 104',
      addr: 'خوشحال خان، ناحیه ۵، کابل',
      photo: '/src/assets/images/teacher_portrait_two_1794554063868.jpg',
      hire: '2024-06-01',
      salary: 980,
      bio: 'محقق و مدرس علم داده، تحلیل آماری با پایتون و مدل‌سازی الگوریتمی.',
    },
    {
      username: 'teacher5',
      email: 'jamshid.rahimi@danesh.edu',
      first: 'استاد جمشید',
      last: 'رحیمی',
      spec: 'حسابداری و مدیریت مالی',
      qual: 'ماستری مدیریت مالی (MBA)',
      phone: '+93 700 200 105',
      addr: 'وزیر اکبرخان، کابل',
      photo: '/src/assets/images/teacher_portrait_one_1794554063169.jpg',
      hire: '2024-07-12',
      salary: 880,
      bio: 'متخصص سیستم‌های حسابداری کویک‌بوکس، اکسل مالی پیشرفته و حسابرسی سازمانی.',
    },
    {
      username: 'teacher6',
      email: 'nilofar.haidari@danesh.edu',
      first: 'استاد نیلوفر',
      last: 'حیدری',
      spec: 'ادبیات دری، پشتو و فن بیان',
      qual: 'ماستری زبان و ادبیات فارسی دری',
      phone: '+93 700 200 106',
      addr: 'کارته سه، کابل',
      photo: '/src/assets/images/teacher_portrait_two_1794554063868.jpg',
      hire: '2024-08-01',
      salary: 780,
      bio: 'مدرس نگارش اداری، ویراستاری معیاری و مهارت‌های سخنرانی علمی.',
    },
    {
      username: 'teacher7',
      email: 'masoud.karimi@danesh.edu',
      first: 'استاد مسعود',
      last: 'کریمی',
      spec: 'گرافیک دیزاین و رابط کاربری',
      qual: 'لیسانس هنرهای زیبا و دیزاین دیجیتال',
      phone: '+93 700 200 107',
      addr: 'قلعه فتح‌الله، کابل',
      photo: '/src/assets/images/teacher_portrait_one_1794554063169.jpg',
      hire: '2024-09-10',
      salary: 820,
      bio: 'طراح ارشد رابط کاربری، تایپوگرافی مدرن و سیستم‌های هویت بصری.',
    },
    {
      username: 'teacher8',
      email: 'royina.rasouli@danesh.edu',
      first: 'استاد روینا',
      last: 'رسولی',
      spec: 'فزیک و ریاضیات ساینسی',
      qual: 'ماستری فزیک نظری',
      phone: '+93 700 200 108',
      addr: 'تایمنی، ناحیه ۴، کابل',
      photo: '/src/assets/images/teacher_portrait_two_1794554063868.jpg',
      hire: '2025-01-15',
      salary: 860,
      bio: 'مدرس آمادگی کانکور، فزیک میکانیک و مفاهیم بنیادی حسابان برای شاگردان ممتاز.',
    },
    {
      username: 'teacher9',
      email: 'basir.ghafari@danesh.edu',
      first: 'استاد بصیر',
      last: 'غفاری',
      spec: 'مهارت‌های اداری و مجموعه آفیس',
      qual: 'لیسانس اداره و تجارت',
      phone: '+93 700 200 109',
      addr: 'خیرخانه، ناحیه ۱۱، کابل',
      photo: '/src/assets/images/teacher_portrait_one_1794554063169.jpg',
      hire: '2025-02-20',
      salary: 750,
      bio: 'متخصص اتوماسیون اداری، اکسل تحلیلی و مدیریت اسناد الکترونیکی.',
    },
    {
      username: 'teacher10',
      email: 'farkhunda.alizada@danesh.edu',
      first: 'استاد فرخنده',
      last: 'علی‌زاده',
      spec: 'مکالمه زبان انگلیسی و تافل',
      qual: 'ماستری آموزش زبان انگلیسی (TESOL)',
      phone: '+93 700 200 110',
      addr: 'برچی، ناحیه ۱۳، کابل',
      photo: '/src/assets/images/teacher_portrait_two_1794554063868.jpg',
      hire: '2025-03-05',
      salary: 840,
      bio: 'مربی بین‌المللی مکالمه انگلیسی، فنون تلفظ و آمادگی آزمون تافل.',
    },
  ];

  const insertTeacher = tx.prepare(
    `INSERT INTO teachers (user_id, teacher_code, first_name, last_name, specialization, qualification, phone, email, address, photo_url, hire_date, base_salary, salary_type, status, bio, show_on_website, featured_on_home)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly', 'active', ?, 1, ?)`
  );

  const teacherUserIds: number[] = [];
  const teacherIds: number[] = [];
  teacherSeed.forEach((t, idx) => {
    const uid = Number(
      insertUser.run(t.username, t.email, teacherHash, 'teacher', `${t.first} ${t.last}`, t.phone, t.photo).lastInsertRowid
    );
    teacherUserIds.push(uid);
    const tid = Number(
      insertTeacher.run(
        uid,
        `TCH-${String(idx + 1).padStart(4, '0')}`,
        t.first,
        t.last,
        t.spec,
        t.qual,
        t.phone,
        t.email,
        t.addr,
        t.photo,
        t.hire,
        t.salary,
        t.bio,
        idx < 4 ? 1 : 0
      ).lastInsertRowid
    );
    teacherIds.push(tid);
  });

  // 12 Students
  const studentSeed = [
    { username: 'student1', email: 'ahmadullah.rahimi@danesh.edu', first: 'احمدالله', last: 'رحیمی', father: 'عبدالرحمن', gender: 'male', dob: '2005-06-14', nid: 'NID-883421', phone: '+93 700 300 201', addr: 'کارته سه، کابل', gName: 'عبدالرحمن رحیمی', gPhone: '+93 700 500 111', gRel: 'پدر', adm: '2026-01-10' },
    { username: 'student2', email: 'fatima.mohammadi@danesh.edu', first: 'فاطمه', last: 'محمدی', father: 'غلام‌سخی', gender: 'female', dob: '2006-02-21', nid: 'NID-883422', phone: '+93 700 300 202', addr: 'دشت برچی، کابل', gName: 'غلام‌سخی محمدی', gPhone: '+93 700 500 222', gRel: 'پدر', adm: '2026-01-12' },
    { username: 'student3', email: 'omid.karimi@danesh.edu', first: 'امید', last: 'کریمی', father: 'محمدناصر', gender: 'male', dob: '2005-11-05', nid: 'NID-883423', phone: '+93 700 300 203', addr: 'مکروریان سوم، کابل', gName: 'محمدناصر کریمی', gPhone: '+93 700 500 333', gRel: 'پدر', adm: '2026-01-15' },
    { username: 'student4', email: 'zuhra.hashimi@danesh.edu', first: 'زهره', last: 'هاشمی', father: 'سیدجواد', gender: 'female', dob: '2006-08-19', nid: 'NID-883424', phone: '+93 700 300 204', addr: 'خیرخانه، کابل', gName: 'سیدجواد هاشمی', gPhone: '+93 700 500 444', gRel: 'پدر', adm: '2026-02-01' },
    { username: 'student5', email: 'yasin.safi@danesh.edu', first: 'یاسین', last: 'صافی', father: 'محمدحسن', gender: 'male', dob: '2005-04-09', nid: 'NID-883425', phone: '+93 700 300 205', addr: 'شهر نو، کابل', gName: 'محمدحسن صافی', gPhone: '+93 700 500 555', gRel: 'پدر', adm: '2026-02-03' },
    { username: 'student6', email: 'marwa.noori@danesh.edu', first: 'مروه', last: 'نوری', father: 'غلام‌ربانی', gender: 'female', dob: '2007-01-28', nid: 'NID-883426', phone: '+93 700 300 206', addr: 'تایمنی، کابل', gName: 'غلام‌ربانی نوری', gPhone: '+93 700 500 666', gRel: 'پدر', adm: '2026-02-05' },
    { username: 'student7', email: 'bilal.ahmadzai@danesh.edu', first: 'بلال', last: 'احمدزی', father: 'حاجی‌اکبر', gender: 'male', dob: '2004-09-12', nid: 'NID-883427', phone: '+93 700 300 207', addr: 'کارته نو، کابل', gName: 'حاجی‌اکبر احمدزی', gPhone: '+93 700 500 777', gRel: 'پدر', adm: '2026-02-08' },
    { username: 'student8', email: 'hasina.azizi@danesh.edu', first: 'حسینه', last: 'عزیزی', father: 'عزیزالله', gender: 'female', dob: '2006-05-16', nid: 'NID-883428', phone: '+93 700 300 208', addr: 'قلعه موسی، کابل', gName: 'عزیزالله عزیزی', gPhone: '+93 700 500 888', gRel: 'پدر', adm: '2026-02-10' },
    { username: 'student9', email: 'sohrab.fayaz@danesh.edu', first: 'سهراب', last: 'فیاض', father: 'عبدالقیوم', gender: 'male', dob: '2005-12-03', nid: 'NID-883429', phone: '+93 700 300 209', addr: 'پروان دوم، کابل', gName: 'عبدالقیوم فیاض', gPhone: '+93 700 500 999', gRel: 'پدر', adm: '2026-02-12' },
    { username: 'student10', email: 'laila.farooqi@danesh.edu', first: 'لیلا', last: 'فاروقی', father: 'محمدفاروق', gender: 'female', dob: '2006-07-24', nid: 'NID-883430', phone: '+93 700 300 210', addr: 'کارته مامورین، کابل', gName: 'محمدفاروق فاروقی', gPhone: '+93 700 500 100', gRel: 'پدر', adm: '2026-02-14' },
    { username: 'student11', email: 'navid.salimi@danesh.edu', first: 'نوید', last: 'سلیمی', father: 'عبدالسلیم', gender: 'male', dob: '2005-03-18', nid: 'NID-883431', phone: '+93 700 300 211', addr: 'افشار، کابل', gName: 'عبدالسلیم سلیمی', gPhone: '+93 700 500 101', gRel: 'پدر', adm: '2026-02-18' },
    { username: 'student12', email: 'sara.zamani@danesh.edu', first: 'سارا', last: 'زمانی', father: 'محمدزمان', gender: 'female', dob: '2006-10-30', nid: 'NID-883432', phone: '+93 700 300 212', addr: 'کارته چهار، کابل', gName: 'محمدزمان زمانی', gPhone: '+93 700 500 102', gRel: 'پدر', adm: '2026-02-20' },
  ];

  const insertStudent = tx.prepare(
    `INSERT INTO students (user_id, student_code, first_name, last_name, father_name, gender, date_of_birth, national_id, phone, email, address, guardian_name, guardian_phone, guardian_relation, admission_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  );

  const studentUserIds: number[] = [];
  const studentIds: number[] = [];
  studentSeed.forEach((s, idx) => {
    const uid = Number(
      insertUser.run(s.username, s.email, studentHash, 'student', `${s.first} ${s.last}`, s.phone, '').lastInsertRowid
    );
    studentUserIds.push(uid);
    const sid = Number(
      insertStudent.run(
        uid,
        `STU-${String(idx + 1).padStart(4, '0')}`,
        s.first,
        s.last,
        s.father,
        s.gender,
        s.dob,
        s.nid,
        s.phone,
        s.email,
        s.addr,
        s.gName,
        s.gPhone,
        s.gRel,
        s.adm,
        'ثبت‌نام شده در دوره منظم اکادمیک ۱۴۰۵'
      ).lastInsertRowid
    );
    studentIds.push(sid);
  });

  // 10 Subjects
  const subjectSeed = [
    { name: 'مهندسی ویب و سیستم‌های معلوماتی', desc: 'توسعه سمت سرور، امنیت API و طراحی سیستم‌های مقیاس‌پذیر.', ch: 4 },
    { name: 'طراحی دیتابیس رابطه‌ای', desc: 'نرمال‌سازی جداول، ایندکس‌گذاری، تراکنش‌ها و بهینه‌سازی کوئری.', ch: 3 },
    { name: 'زبان انگلیسی اکادمیک و نگارش آیلتس', desc: 'ساختار مقاله علمی، واژگان تخصصی، شنیداری و مکالمه سمینار.', ch: 4 },
    { name: 'ریاضیات گسسته و تحلیلی', desc: 'منطق ریاضی، ترکیبیات، ماتریس‌ها و استدلال الگوریتمی.', ch: 3 },
    { name: 'فن بیان و نگارش علمی دری', desc: 'مکاتبات رسمی، ویراستاری اکادمیک و مهارت‌های ارائه علمی.', ch: 2 },
    { name: 'برنامه‌نویسی پایتون و الگوریتم‌ها', desc: 'ساختار داده‌ها، برنامه‌نویسی شی‌گرا و حل مسائل کاربردی.', ch: 4 },
    { name: 'شبکه‌های کمپیوتری و امنیت', desc: 'مفاهیم TCP/IP، مسیریابی، دیوار آتش و امنیت شبکه.', ch: 3 },
    { name: 'حسابداری و مدیریت مالی', desc: 'دفتر کل، ترازنامه، گزارش سود و زیان و اکسل مالی.', ch: 3 },
    { name: 'مهارت‌های کمپیوتر دفتری و اکسل پیشرفته', desc: 'فرمول‌های تحلیلی اکسل، ورد حرفه‌ای و ارائه پاورپوینت.', ch: 3 },
    { name: 'مبانی فزیک و علوم ساینسی', desc: 'میکانیک، الکترومغناطیس و حل مسائل آزمایشگاهی ساینس.', ch: 3 },
  ];
  const insertSub = tx.prepare(
    `INSERT INTO subjects (subject_code, name, description, credit_hours, status) VALUES (?, ?, ?, ?, 'active')`
  );
  const subjectIds: number[] = subjectSeed.map((s, idx) =>
    Number(insertSub.run(`SUB-${String(idx + 1).padStart(4, '0')}`, s.name, s.desc, s.ch).lastInsertRowid)
  );

  // 10 Courses
  const courseSeed = [
    { title: 'دیپلوم مهندسی نرم‌افزار فول‌استک', desc: 'دوره ۲۴ هفته‌ای جامع شامل دیتابیس، برنامه‌نویسی سمت سرور، امنیت و طراحی رابط کاربری مدرن.', weeks: 24, start: '2026-02-01', end: '2026-07-20', fee: 480, cap: 30, feat: 1, img: '/src/assets/images/hero_science_lab_1794554063311.jpg' },
    { title: 'کورس تخصصی زبان انگلیسی و آمادگی آیلتس', desc: 'دوره فشرده ۱۶ هفته‌ای برای تسلط اکادمیک، مقاله نویسی و آمادگی آزمون بین‌المللی آیلتس.', weeks: 16, start: '2026-02-15', end: '2026-06-10', fee: 320, cap: 25, feat: 1, img: '/src/assets/images/hero_academy_campus_1794554062936.jpg' },
    { title: 'کورس ریاضیات تحلیلی و مبانی علم داده', desc: 'برنامه ۱۸ هفته‌ای ساختاریافته برای پیوند ریاضیات خطی، آمار و مدل‌سازی دیتابیس.', weeks: 18, start: '2026-03-01', end: '2026-07-05', fee: 360, cap: 28, feat: 1, img: '/src/assets/images/gallery_graduation_1794554064196.jpg' },
    { title: 'کورس کمپیوتر پیشرفته و اتوماسیون دفتری', desc: 'آموزش عملی ویندوز، ورد، اکسل تحلیلی، پاورپوینت و مدیریت اسناد برای کارمندان اداری.', weeks: 12, start: '2026-03-10', end: '2026-06-01', fee: 220, cap: 25, feat: 0, img: '/src/assets/images/hero_science_lab_1794554063311.jpg' },
    { title: 'کورس شبکه‌های کمپیوتری و امنیت سایبری', desc: 'دوره عملی پیاده‌سازی شبکه، پیکربندی تجهیزات سیسکو و اصول امنیت سیستم‌ها.', weeks: 20, start: '2026-03-15', end: '2026-08-05', fee: 420, cap: 22, feat: 0, img: '/src/assets/images/hero_academy_campus_1794554062936.jpg' },
    { title: 'کورس برنامه‌نویسی پایتون از مقدماتی تا پیشرفته', desc: 'آموزش گام‌به‌گام زبان پایتون، ساختار داده‌ها و پروژه‌های عملی تحلیل داده.', weeks: 16, start: '2026-04-01', end: '2026-07-22', fee: 350, cap: 26, feat: 0, img: '/src/assets/images/hero_science_lab_1794554063311.jpg' },
    { title: 'کورس حسابداری کاربردی و نرم‌افزارهای مالی', desc: 'آموزش اصول حسابداری دوبل، تهیه گزارش‌های مالی و کار عملی با اکسل مالی.', weeks: 14, start: '2026-04-05', end: '2026-07-12', fee: 300, cap: 24, feat: 0, img: '/src/assets/images/gallery_graduation_1794554064196.jpg' },
    { title: 'کورس گرافیک دیزاین و طراحی رابط کاربری', desc: 'آموزش فتوشاپ، ایلاستریتور، فیگما و اصول دیزاین هویت بصری و وب‌سایت.', weeks: 16, start: '2026-04-12', end: '2026-08-01', fee: 340, cap: 22, feat: 0, img: '/src/assets/images/hero_academy_campus_1794554062936.jpg' },
    { title: 'کورس آمادگی ویژه کانکور و علوم ساینسی', desc: 'تقویت همه‌جانبه ریاضی، فزیک و ادبیات برای کامیابی در آزمون سراسری کانکور.', weeks: 24, start: '2026-04-20', end: '2026-10-05', fee: 280, cap: 35, feat: 0, img: '/src/assets/images/hero_science_lab_1794554063311.jpg' },
    { title: 'کورس مکالمه انگلیسی و آمادگی تافل', desc: 'تمرکز بر مهارت گفتاری، درک مطلب پیشرفته و تمرین آزمون‌های استاندارد تافل.', weeks: 14, start: '2026-05-01', end: '2026-08-10', fee: 310, cap: 20, feat: 0, img: '/src/assets/images/gallery_graduation_1794554064196.jpg' },
  ];
  const insertCourse = tx.prepare(
    `INSERT INTO courses (course_code, title, description, duration_weeks, start_date, end_date, fee_amount, capacity, featured, image_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  );
  const courseIds: number[] = courseSeed.map((c, idx) =>
    Number(
      insertCourse.run(
        `CRS-${String(idx + 1).padStart(4, '0')}`,
        c.title,
        c.desc,
        c.weeks,
        c.start,
        c.end,
        c.fee,
        c.cap,
        c.feat,
        c.img
      ).lastInsertRowid
    )
  );

  // Course-Subject links (20 rows)
  const linkCourseSub = tx.prepare(`INSERT INTO course_subjects (course_id, subject_id) VALUES (?, ?)`);
  const csPairs: Array<[number, number]> = [
    [0, 0], [0, 1],
    [1, 2], [1, 4],
    [2, 3], [2, 1],
    [3, 8], [3, 4],
    [4, 6], [4, 0],
    [5, 5], [5, 1],
    [6, 7], [6, 8],
    [7, 0], [7, 8],
    [8, 9], [8, 3],
    [9, 2], [9, 4],
  ];
  for (const [ci, si] of csPairs) {
    linkCourseSub.run(courseIds[ci], subjectIds[si]);
  }

  // 10 Classes
  const classSeed = [
    { name: 'صنف اول — مهندسی نرم‌افزار (دوره الف)', level: 'سطح دیپلوم ۱', ci: 0, cap: 25, room: 'لابراتوار ۲۰۱', start: '2026-02-01', end: '2026-07-20' },
    { name: 'صنف دوم — انگلیسی و آیلتس صبح (B1)', level: 'متوسط پیشرفته', ci: 1, cap: 20, room: 'تالار ۱۰۴', start: '2026-02-15', end: '2026-06-10' },
    { name: 'صنف سوم — مبانی ریاضیات تحلیلی', level: 'دوره بنیادی', ci: 2, cap: 24, room: 'صنف ۱۰۸', start: '2026-03-01', end: '2026-07-05' },
    { name: 'صنف چهارم — کمپیوتر و اکسل اداری', level: 'عمومی و پیشرفته', ci: 3, cap: 25, room: 'لابراتوار ۲۰۳', start: '2026-03-10', end: '2026-06-01' },
    { name: 'صنف پنجم — شبکه‌های کمپیوتری و امنیت', level: 'تخصصی شبکه', ci: 4, cap: 22, room: 'لابراتوار شبکه', start: '2026-03-15', end: '2026-08-05' },
    { name: 'صنف ششم — برنامه‌نویسی پایتون', level: 'سطح میانی', ci: 5, cap: 26, room: 'لابراتوار ۲۰۲', start: '2026-04-01', end: '2026-07-22' },
    { name: 'صنف هفتم — حسابداری کاربردی', level: 'مهارتی مالی', ci: 6, cap: 24, room: 'صنف ۱۰۵', start: '2026-04-05', end: '2026-07-12' },
    { name: 'صنف هشتم — گرافیک دیزاین و UI', level: 'استودیو دیزاین', ci: 7, cap: 22, room: 'لابراتوار گرافیک', start: '2026-04-12', end: '2026-08-01' },
    { name: 'صنف نهم — آمادگی ویژه کانکور', level: 'پشتیبانی ساینس', ci: 8, cap: 35, room: 'تالار ۲۰۱', start: '2026-04-20', end: '2026-10-05' },
    { name: 'صنف دهم — مکالمه انگلیسی و تافل', level: 'سطح پیشرفته', ci: 9, cap: 20, room: 'صنف ۱۰۲', start: '2026-05-01', end: '2026-08-10' },
  ];
  const insertClass = tx.prepare(
    `INSERT INTO classes (class_code, name, level, course_id, capacity, room, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  );
  const classIds: number[] = classSeed.map((cl, idx) =>
    Number(
      insertClass.run(
        `CLS-${String(idx + 1).padStart(4, '0')}`,
        cl.name,
        cl.level,
        courseIds[cl.ci],
        cl.cap,
        cl.room,
        cl.start,
        cl.end
      ).lastInsertRowid
    )
  );

  // Class-Subject-Teacher Assignments (20 rows covering all 10 classes & 10 teachers)
  const assignTch = tx.prepare(`INSERT INTO class_subject_teachers (class_id, subject_id, teacher_id) VALUES (?, ?, ?)`);
  const cstSeed: Array<[number, number, number]> = [
    [0, 0, 0], [0, 1, 0],
    [1, 2, 1], [1, 4, 5],
    [2, 3, 1], [2, 1, 0],
    [3, 8, 8], [3, 4, 5],
    [4, 6, 2], [4, 0, 0],
    [5, 5, 3], [5, 1, 3],
    [6, 7, 4], [6, 8, 4],
    [7, 0, 6], [7, 8, 6],
    [8, 9, 7], [8, 3, 7],
    [9, 2, 9], [9, 4, 9],
  ];
  for (const [cli, si, ti] of cstSeed) {
    assignTch.run(classIds[cli], subjectIds[si], teacherIds[ti]);
  }

  // Enrollments (16 rows across all 12 students and 10 classes)
  const insertEnroll = tx.prepare(
    `INSERT INTO enrollments (student_id, class_id, course_id, enrolled_at, status) VALUES (?, ?, ?, ?, 'active')`
  );
  const enrollPairs: Array<{ si: number; cli: number; date: string }> = [
    { si: 0, cli: 0, date: '2026-02-01' },
    { si: 1, cli: 0, date: '2026-02-01' },
    { si: 2, cli: 1, date: '2026-02-15' },
    { si: 3, cli: 2, date: '2026-03-01' },
    { si: 4, cli: 3, date: '2026-03-10' },
    { si: 5, cli: 4, date: '2026-03-15' },
    { si: 6, cli: 5, date: '2026-04-01' },
    { si: 7, cli: 6, date: '2026-04-05' },
    { si: 8, cli: 7, date: '2026-04-12' },
    { si: 9, cli: 8, date: '2026-04-20' },
    { si: 10, cli: 9, date: '2026-05-01' },
    { si: 11, cli: 1, date: '2026-05-03' },
    { si: 0, cli: 2, date: '2026-03-05' },
    { si: 1, cli: 5, date: '2026-04-02' },
    { si: 2, cli: 9, date: '2026-05-02' },
    { si: 3, cli: 3, date: '2026-03-12' },
  ];
  const enrollmentIds: number[] = enrollPairs.map((e) =>
    Number(insertEnroll.run(studentIds[e.si], classIds[e.cli], courseIds[classSeed[e.cli].ci], e.date).lastInsertRowid)
  );

  // Timetables (14 conflict-free slots across Saturday-Thursday)
  const insertTT = tx.prepare(
    `INSERT INTO timetables (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const ttSeed: Array<[number, number, number, string, string, string, string]> = [
    [0, 0, 0, 'Saturday', '08:00', '09:30', 'لابراتوار ۲۰۱'],
    [0, 1, 0, 'Monday', '08:00', '09:30', 'لابراتوار ۲۰۱'],
    [0, 0, 0, 'Wednesday', '08:00', '09:30', 'لابراتوار ۲۰۱'],
    [1, 2, 1, 'Saturday', '10:00', '11:30', 'تالار ۱۰۴'],
    [1, 4, 5, 'Tuesday', '10:00', '11:30', 'تالار ۱۰۴'],
    [2, 3, 1, 'Sunday', '08:30', '10:00', 'صنف ۱۰۸'],
    [2, 1, 0, 'Thursday', '10:00', '11:30', 'صنف ۱۰۸'],
    [3, 8, 8, 'Sunday', '10:30', '12:00', 'لابراتوار ۲۰۳'],
    [4, 6, 2, 'Monday', '10:00', '11:30', 'لابراتوار شبکه'],
    [5, 5, 3, 'Tuesday', '08:00', '09:30', 'لابراتوار ۲۰۲'],
    [6, 7, 4, 'Wednesday', '10:00', '11:30', 'صنف ۱۰۵'],
    [7, 0, 6, 'Thursday', '08:00', '09:30', 'لابراتوار گرافیک'],
    [8, 9, 7, 'Saturday', '13:30', '15:00', 'تالار ۲۰۱'],
    [9, 2, 9, 'Sunday', '13:30', '15:00', 'صنف ۱۰۲'],
  ];
  for (const [cli, si, ti, day, st, et, room] of ttSeed) {
    insertTT.run(classIds[cli], subjectIds[si], teacherIds[ti], day, st, et, room);
  }

  // Grading Rules (10 non-overlapping bands covering 0-100)
  const insertRule = tx.prepare(
    `INSERT INTO grading_rules (grade_letter, min_percent, max_percent, gpa_points, description, is_passing) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const rulesSeed: Array<[string, number, number, number, string, number]> = [
    ['A+', 95, 100, 4.0, 'عالی ممتاز', 1],
    ['A', 90, 94.99, 3.85, 'بسیار عالی', 1],
    ['A-', 85, 89.99, 3.65, 'عالی', 1],
    ['B+', 80, 84.99, 3.3, 'خوب بسیار', 1],
    ['B', 75, 79.99, 3.0, 'خوب', 1],
    ['B-', 70, 74.99, 2.7, 'نسبتاً خوب', 1],
    ['C+', 65, 69.99, 2.35, 'متوسط بالا', 1],
    ['C', 60, 64.99, 2.0, 'متوسط', 1],
    ['D', 50, 59.99, 1.5, 'کامیاب مشروط', 1],
    ['F', 0, 49.99, 0.0, 'ناکام', 0],
  ];
  for (const r of rulesSeed) {
    insertRule.run(...r);
  }

  // Student Attendance (24 records)
  const insertAtt = tx.prepare(
    `INSERT INTO student_attendance (class_id, student_id, attendance_date, session_label, status, remarks, recorded_by)
     VALUES (?, ?, ?, 'صبح', ?, ?, ?)`
  );
  const attSeed: Array<[number, number, string, string, string, number]> = [
    [0, 0, '2026-11-08', 'present', 'حضور به موقع', teacherUserIds[0]],
    [0, 1, '2026-11-08', 'present', 'حضور به موقع', teacherUserIds[0]],
    [0, 0, '2026-11-10', 'present', 'مشارکت فعال در لابراتوار', teacherUserIds[0]],
    [0, 1, '2026-11-10', 'late', 'تاخیر ۱۰ دقیقه به دلیل ترافیک', teacherUserIds[0]],
    [1, 2, '2026-11-08', 'present', '', teacherUserIds[1]],
    [1, 11, '2026-11-08', 'present', '', teacherUserIds[1]],
    [1, 2, '2026-11-10', 'excused', 'رخصتی رسمی با موافقه اداره', teacherUserIds[1]],
    [2, 3, '2026-11-09', 'present', '', teacherUserIds[1]],
    [2, 0, '2026-11-09', 'present', '', teacherUserIds[0]],
    [3, 4, '2026-11-09', 'present', '', teacherUserIds[8]],
    [3, 3, '2026-11-09', 'late', 'تاخیر ۵ دقیقه', teacherUserIds[8]],
    [4, 5, '2026-11-09', 'present', '', teacherUserIds[2]],
    [5, 6, '2026-11-10', 'present', '', teacherUserIds[3]],
    [5, 1, '2026-11-10', 'present', '', teacherUserIds[3]],
    [6, 7, '2026-11-11', 'absent', 'غیبت غیرموجه', teacherUserIds[4]],
    [7, 8, '2026-11-11', 'present', '', teacherUserIds[6]],
    [8, 9, '2026-11-11', 'present', '', teacherUserIds[7]],
    [9, 10, '2026-11-12', 'present', '', teacherUserIds[9]],
    [9, 2, '2026-11-12', 'present', '', teacherUserIds[9]],
    [0, 0, '2026-11-12', 'present', '', teacherUserIds[0]],
    [0, 1, '2026-11-12', 'present', '', teacherUserIds[0]],
    [4, 5, '2026-11-11', 'excused', 'مریضی با اطلاع قبلی', teacherUserIds[2]],
    [6, 7, '2026-11-12', 'present', '', teacherUserIds[4]],
    [8, 9, '2026-11-12', 'late', 'تاخیر جزئی', teacherUserIds[7]],
  ];
  for (const [cli, si, date, status, rem, recBy] of attSeed) {
    insertAtt.run(classIds[cli], studentIds[si], date, status, rem, recBy);
  }

  // Teacher Attendance (12 records across all 10 teachers)
  const insertTchAtt = tx.prepare(
    `INSERT INTO teacher_attendance (teacher_id, attendance_date, status, check_in_time, check_out_time, remarks, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tchAttSeed: Array<[number, string, string, string, string, string]> = [
    [0, '2026-11-10', 'present', '07:50', '15:30', 'حاضر در لابراتوار',],
    [1, '2026-11-10', 'present', '08:15', '15:00', 'حضور منظم',],
    [2, '2026-11-10', 'present', '08:20', '14:30', '',],
    [3, '2026-11-10', 'present', '07:55', '14:00', '',],
    [4, '2026-11-10', 'late', '08:35', '15:10', 'تاخیر جزئی در ترافیک',],
    [5, '2026-11-10', 'present', '08:00', '14:30', '',],
    [6, '2026-11-10', 'present', '08:10', '15:00', '',],
    [7, '2026-11-10', 'present', '08:05', '16:00', '',],
    [8, '2026-11-10', 'excused', '', '', 'رخصتی رسمی روز سه‌شنبه',],
    [9, '2026-11-10', 'present', '08:20', '15:15', '',],
    [0, '2026-11-11', 'present', '07:55', '15:25', '',],
    [1, '2026-11-11', 'present', '08:10', '15:10', '',],
  ];
  for (const [ti, date, status, cin, cout, rem] of tchAttSeed) {
    insertTchAtt.run(teacherIds[ti], date, status, cin, cout, rem, adminId);
  }

  // Examinations (10 exams)
  const insertExam = tx.prepare(
    `INSERT INTO examinations (title, exam_type, class_id, subject_id, exam_date, max_score, passing_score, is_published, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const examSeed: Array<[string, string, number, number, string, number, number, number]> = [
    ['امتحان میان‌سمستر مدل‌سازی دیتابیس رابطه‌ای', 'midterm', 0, 1, '2026-10-28', 100, 50, 1],
    ['ارزیابی مقاله اکادمیک آیلتس', 'assessment', 1, 2, '2026-10-30', 100, 60, 1],
    ['امتحان ریاضیات گسسته و منطق', 'midterm', 2, 3, '2026-11-01', 100, 50, 1],
    ['ارزیابی عملی اکسل تحلیلی و آفیس', 'practical', 3, 8, '2026-11-02', 100, 55, 1],
    ['امتحان پیکربندی شبکه‌های کمپیوتری', 'midterm', 4, 6, '2026-11-04', 100, 50, 1],
    ['آزمون برنامه‌نویسی پایتون و الگوریتم', 'midterm', 5, 5, '2026-11-05', 100, 50, 1],
    ['امتحان اصول حسابداری و ترازنامه', 'midterm', 6, 7, '2026-11-06', 100, 55, 1],
    ['ارزیابی پروژه گرافیک دیزاین', 'practical', 7, 0, '2026-11-07', 100, 60, 1],
    ['آزمون آزمایشی کانکور — بخش ساینس', 'quiz', 8, 9, '2026-11-08', 100, 50, 1],
    ['امتحان نهایی مکالمه انگلیسی و تافل', 'final', 9, 2, '2026-11-18', 100, 60, 0],
  ];
  const examIds: number[] = examSeed.map((ex) =>
    Number(insertExam.run(ex[0], ex[1], classIds[ex[2]], subjectIds[ex[3]], ex[4], ex[5], ex[6], ex[7], adminId).lastInsertRowid)
  );

  // Exam Grades (20 records)
  const insertGrade = tx.prepare(
    `INSERT INTO exam_grades (exam_id, student_id, score, feedback, graded_by) VALUES (?, ?, ?, ?, ?)`
  );
  const gradeSeed: Array<[number, number, number, string, number]> = [
    [0, 0, 94, 'ساختار نرمال‌سازی قوی و کلیدهای خارجی بسیار دقیق.', teacherUserIds[0]],
    [0, 1, 97, 'عملکرد برتر در طراحی تراکنش‌ها و ایندکس‌گذاری دیتابیس.', teacherUserIds[0]],
    [1, 2, 86, 'استدلال علمی روشن و پیوستگی مناسب پاراگراف‌ها.', teacherUserIds[1]],
    [1, 11, 91, 'واژگان اکادمیک دقیق و نگارش روان.', teacherUserIds[1]],
    [2, 3, 88, 'حل منظم مسائل ترکیبیات و گراف‌ها.', teacherUserIds[1]],
    [2, 0, 92, 'تحلیل منطقی دقیق در بخش جبر خطی.', teacherUserIds[1]],
    [3, 4, 84, 'تسلط خوب بر فرمول‌های مالی و جداول محوری اکسل.', teacherUserIds[8]],
    [3, 3, 89, 'گزارش‌دهی حرفه‌ای و بدون خطا.', teacherUserIds[8]],
    [4, 5, 90, 'پیکربندی درست VLAN و امنیت پورت‌ها.', teacherUserIds[2]],
    [5, 6, 85, 'کدنویسی تمیز و استفاده مناسب از توابع بازگشتی.', teacherUserIds[3]],
    [5, 1, 95, 'بهینه‌سازی عالی الگوریتم‌های جستجو و مرتب‌سازی.', teacherUserIds[3]],
    [6, 7, 79, 'ثبت درست اسناد حسابداری، نیاز به تمرین بیشتر در تراز آزمایشی.', teacherUserIds[4]],
    [7, 8, 93, 'ترکیب رنگ و تایپوگرافی بسیار منسجم.', teacherUserIds[6]],
    [8, 9, 87, 'پاسخ‌گویی سریع به سوالات فزیک و ریاضیات.', teacherUserIds[7]],
    [0, 2, 81, 'درک مناسب از مفاهیم SQL.', teacherUserIds[0]],
    [2, 4, 76, 'نیاز به تمرین بیشتر در بخش اثبات ریاضی.', teacherUserIds[1]],
    [4, 6, 82, 'تشخیص درست آدرس‌های IP و زیرشبکه‌ها.', teacherUserIds[2]],
    [6, 8, 84, 'تنظیم دقیق صورت حساب سود و زیان.', teacherUserIds[4]],
    [7, 10, 90, 'طراحی واکنش‌گرا و مرتب.', teacherUserIds[6]],
    [8, 11, 88, 'نتیجه مطلوب در بخش تحلیل عددی.', teacherUserIds[7]],
  ];
  for (const [ei, si, score, fb, gBy] of gradeSeed) {
    insertGrade.run(examIds[ei], studentIds[si], score, fb, gBy);
  }

  // Homework (10 records)
  const insertHw = tx.prepare(
    `INSERT INTO homework (title, description, class_id, subject_id, teacher_id, due_date, max_score) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const hwSeed: Array<[string, string, number, number, number, string, number]> = [
    ['کارخانگی هفته اول: نرمال‌سازی دیتابیس فروشگاهی تا 3NF', 'نمودار ERD و اسکریپت SQL شامل جداول مشتریان، سفارشات و پرداخت‌ها را ارسال کنید.', 0, 1, 0, '2026-11-22', 100],
    ['مقاله تحلیلی: آموزش دوزبانه در علوم ساینسی', 'یک مقاله ۴۵۰ کلمه‌ای اکادمیک با دو استدلال علمی و نتیجه‌گیری منسجم بنویسید.', 1, 2, 1, '2026-11-20', 100],
    ['تمرین هفته دوم: منطق گزاره‌ها و جداول ارزش', 'سوالات فصل دوم کتاب ریاضیات گسسته را به صورت کامل حل نمایید.', 2, 3, 1, '2026-11-24', 100],
    ['پروژه اکسل: بودجه‌بندی ماهانه مرکز آموزشی', 'فایل اکسل شامل توابع SUMIF، VLOOKUP و نمودار مقایسه مصارف تهیه کنید.', 3, 8, 8, '2026-11-21', 100],
    ['طراحی آدرس‌دهی IPv4 و تقسیم زیرشبکه (Subnetting)', 'جدول تخصیص IP برای چهار شعبه با ماسک‌های متفاوت آماده نمایید.', 4, 6, 2, '2026-11-23', 100],
    ['پیاده‌سازی سیستم مدیریت کتابخانه با پایتون', 'برنامه خط فرمان با قابلیت ثبت کتاب، امانت‌دهی و جستجو بنویسید.', 5, 5, 3, '2026-11-25', 100],
    ['تنظیم دفتر روزنامه و تراز آزمایشی ماه عقرب', 'تمامی معاملات فرضی ضمیمه را در دفتر کل و تراز آزمایشی درج کنید.', 6, 7, 4, '2026-11-19', 100],
    ['طراحی پوستر اطلاع‌رسانی سمینار علمی', 'یک پوستر معیاری در ابعاد A3 با رعایت سلسله‌مراتب بصری طراحی کنید.', 7, 0, 6, '2026-11-26', 100],
    ['مجموعه تست‌های میکانیک و حرکت یکنواخت', '۳۰ سوال چهارگزینه‌ای بخش حرکت‌شناسی را با تشریح راه‌حل بفرستید.', 8, 9, 7, '2026-11-27', 100],
    ['خلاصه‌سازی سخنرانی علمی و ضبط فایل صوتی', 'پادکست ۵ دقیقه‌ای معرفی‌شده را خلاصه کرده و نکات کلیدی را بنویسید.', 9, 2, 9, '2026-11-28', 100],
  ];
  const hwIds: number[] = hwSeed.map((h) =>
    Number(insertHw.run(h[0], h[1], classIds[h[2]], subjectIds[h[3]], teacherIds[h[4]], h[5], h[6]).lastInsertRowid)
  );

  // Homework Submissions (14 records: mix of graded and pending review 'submitted')
  const insertSubm = tx.prepare(
    `INSERT INTO homework_submissions (homework_id, student_id, response_text, submitted_at, is_late, score, feedback, status, graded_by, graded_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
  );
  const submSeed: Array<[number, number, string, string, number | null, string, string, number | null, string | null]> = [
    [0, 1, 'ساختار 3NF با کلیدهای یکتا برای اقلام سفارش و دفتر پرداخت تکمیل و ارسال گردید.', '2026-11-11 14:20:00', 96, 'ساختار بسیار منظم و بدون افزونگی.', 'graded', teacherUserIds[0], '2026-11-12 09:00:00'],
    [1, 2, 'پیش‌نویس مقاله با تمرکز بر هم‌سویی مفاهیم فنی در زبان دری و انگلیسی ارسال شد.', '2026-11-12 10:15:00', null, '', 'submitted', null, null],
    [0, 0, 'اسکریپت SQL و روابط جداول همراه با نمودار ضمیمه ارسال شد.', '2026-11-12 11:05:00', null, '', 'submitted', null, null],
    [2, 3, 'تمامی ده سوال بخش منطق و جداول ارزش حل و بررسی شد.', '2026-11-11 16:40:00', 90, 'راه‌حل‌های بسیار دقیق و خوانا.', 'graded', teacherUserIds[1], '2026-11-12 10:00:00'],
    [3, 4, 'جدول بودجه‌بندی همراه با فرمول‌های خودکار و نمودار ستونی آماده شد.', '2026-11-12 09:30:00', 88, 'کاربرد خوب از توابع جستجو.', 'graded', teacherUserIds[8], '2026-11-12 15:00:00'],
    [4, 5, 'محاسبات زیرشبکه برای هر چهار شعبه تکمیل گردید.', '2026-11-12 13:10:00', null, '', 'submitted', null, null],
    [5, 6, 'کد پایتون پروژه کتابخانه با ذخیره‌سازی در فایل JSON آماده شد.', '2026-11-11 18:20:00', 92, 'معماری کد عالی و خوانا است.', 'graded', teacherUserIds[3], '2026-11-12 11:20:00'],
    [6, 7, 'دفتر روزنامه و تراز آزمایشی ماه عقرب ثبت و توازن آن چک شد.', '2026-11-12 08:45:00', 85, 'تراز درست است؛ شرح دو سند اصلاح شود.', 'graded', teacherUserIds[4], '2026-11-12 14:15:00'],
    [7, 8, 'طرح اولیه پوستر با رنگ‌های رسمی آکادمی و فایل لایه‌باز ارسال شد.', '2026-11-12 16:00:00', null, '', 'submitted', null, null],
    [8, 9, 'پاسخ کامل ۳۰ سوال میکانیک با رسم نمودار شتاب-زمان.', '2026-11-12 12:30:00', 91, 'تحلیل خوب سوالات محاسباتی.', 'graded', teacherUserIds[7], '2026-11-12 17:00:00'],
    [9, 10, 'متن خلاصه سخنرانی و فهرست اصطلاحات کلیدی ارسال گردید.', '2026-11-12 14:50:00', null, '', 'submitted', null, null],
    [1, 11, 'متن نهایی مقاله آیلتس با ارجاعات علمی ویرایش و ارسال شد.', '2026-11-12 15:20:00', 93, 'ساختار و واژگان عالی.', 'graded', teacherUserIds[1], '2026-11-12 18:00:00'],
    [2, 0, 'تمرین‌های ریاضیات گسسته حل و ارسال گردید.', '2026-11-12 17:10:00', null, '', 'submitted', null, null],
    [5, 1, 'نسخه بهینه‌شده پروژه کتابخانه با جستجوی سریع ارسال شد.', '2026-11-12 17:45:00', 97, 'بهترین پیاده‌سازی در میان شاگردان.', 'graded', teacherUserIds[3], '2026-11-12 19:00:00'],
  ];
  for (const s of submSeed) {
    insertSubm.run(hwIds[s[0]], studentIds[s[1]], s[2], s[3], s[4], s[5], s[6], s[7], s[8]);
  }

  // Fee Definitions (10 definitions)
  const insertFeeDef = tx.prepare(
    `INSERT INTO fee_definitions (title, course_id, amount, fee_type, description) VALUES (?, ?, ?, ?, ?)`
  );
  const feeDefSeed: Array<[string, number, number, string, string]> = [
    ['فیس دوره دیپلوم مهندسی نرم‌افزار', 0, 480, 'tuition', 'فیس مکمل دوره ۲۴ هفته‌ای دیپلوم'],
    ['فیس دوره انگلیسی و آمادگی آیلتس', 1, 320, 'tuition', 'فیس دوره ۱۶ هفته‌ای اکادمیک'],
    ['فیس دوره ریاضیات تحلیلی و علم داده', 2, 360, 'tuition', 'فیس دوره ۱۸ هفته‌ای تحلیلی'],
    ['فیس دوره کمپیوتر پیشرفته و اکسل', 3, 220, 'tuition', 'فیس دوره ۱۲ هفته‌ای اداری'],
    ['فیس دوره شبکه‌های کمپیوتری و امنیت', 4, 420, 'tuition', 'فیس دوره ۲۰ هفته‌ای لابراتواری'],
    ['فیس دوره برنامه‌نویسی پایتون', 5, 350, 'tuition', 'فیس دوره ۱۶ هفته‌ای عملی'],
    ['فیس دوره حسابداری کاربردی', 6, 300, 'tuition', 'فیس دوره ۱۴ هفته‌ای مالی'],
    ['فیس دوره گرافیک دیزاین و رابط کاربری', 7, 340, 'tuition', 'فیس دوره ۱۶ هفته‌ای استودیو'],
    ['فیس دوره آمادگی ویژه کانکور', 8, 280, 'tuition', 'فیس دوره ۲۴ هفته‌ای تقویتی'],
    ['فیس ثبت‌نام و کارت هویت شاگرد', 9, 40, 'registration', 'هزینه ثبت‌نام، کتیبه و صدور کارت هوشمند'],
  ];
  const feeDefIds: number[] = feeDefSeed.map((fd) =>
    Number(insertFeeDef.run(fd[0], courseIds[fd[1]], fd[2], fd[3], fd[4]).lastInsertRowid)
  );

  // Student Fees (12 records) + Payments (12 records) reconciled accurately
  const insertStuFee = tx.prepare(
    `INSERT INTO student_fees (student_id, enrollment_id, fee_definition_id, title, total_amount, discount_amount, paid_amount, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertPayment = tx.prepare(
    `INSERT INTO payments (receipt_number, student_fee_id, student_id, amount, payment_method, payment_date, idempotency_key, notes, received_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertIncome = tx.prepare(
    `INSERT INTO income_records (title, category, amount, income_date, payment_id, description, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const feePlans: Array<{
    si: number;
    ei: number;
    fdi: number;
    title: string;
    total: number;
    discount: number;
    dueDate: string;
    payments: Array<{ amt: number; method: string; date: string; note: string }>;
  }> = [
    {
      si: 0, ei: 0, fdi: 0, title: 'فیس مهندسی نرم‌افزار — قسط دوره اول', total: 480, discount: 0, dueDate: '2026-11-25',
      payments: [
        { amt: 200, method: 'cash', date: '2026-08-18', note: 'پرداخت قسط اول ثبت‌نام' },
        { amt: 100, method: 'bank', date: '2026-09-12', note: 'پرداخت قسط دوم ماه میزان' },
      ],
    },
    {
      si: 1, ei: 1, fdi: 0, title: 'فیس مهندسی نرم‌افزار — دوره مکمل', total: 480, discount: 40, dueDate: '2026-10-01',
      payments: [{ amt: 440, method: 'bank', date: '2026-09-15', note: 'پرداخت کامل با تخفیف شاگرد ممتاز' }],
    },
    {
      si: 2, ei: 2, fdi: 1, title: 'فیس کورس انگلیسی و آیلتس', total: 320, discount: 0, dueDate: '2026-11-20',
      payments: [{ amt: 160, method: 'card', date: '2026-10-05', note: 'پرداخت نیمه اول فیس' }],
    },
    {
      si: 3, ei: 3, fdi: 2, title: 'فیس کورس ریاضیات تحلیلی', total: 360, discount: 0, dueDate: '2026-11-28',
      payments: [],
    },
    {
      si: 4, ei: 4, fdi: 3, title: 'فیس کورس کمپیوتر و اکسل اداری', total: 220, discount: 20, dueDate: '2026-10-15',
      payments: [{ amt: 200, method: 'cash', date: '2026-09-20', note: 'تصفیه کامل فیس کمپیوتر' }],
    },
    {
      si: 5, ei: 5, fdi: 4, title: 'فیس کورس شبکه‌های کمپیوتری', total: 420, discount: 0, dueDate: '2026-11-30',
      payments: [{ amt: 220, method: 'transfer', date: '2026-10-12', note: 'انتقال بانکی قسط اول' }],
    },
    {
      si: 6, ei: 6, fdi: 5, title: 'فیس کورس برنامه‌نویسی پایتون', total: 350, discount: 0, dueDate: '2026-10-25',
      payments: [{ amt: 350, method: 'bank', date: '2026-10-02', note: 'پرداخت کامل دوره پایتون' }],
    },
    {
      si: 7, ei: 7, fdi: 6, title: 'فیس کورس حسابداری کاربردی', total: 300, discount: 0, dueDate: '2026-11-24',
      payments: [{ amt: 150, method: 'cash', date: '2026-10-22', note: 'قسط نخست دوره حسابداری' }],
    },
    {
      si: 8, ei: 8, fdi: 7, title: 'فیس کورس گرافیک دیزاین و UI', total: 340, discount: 30, dueDate: '2026-11-10',
      payments: [{ amt: 310, method: 'card', date: '2026-10-28', note: 'پرداخت با تخفیف ثبت‌نام زودهنگام' }],
    },
    {
      si: 9, ei: 9, fdi: 8, title: 'فیس کورس آمادگی ویژه کانکور', total: 280, discount: 0, dueDate: '2026-11-26',
      payments: [{ amt: 140, method: 'cash', date: '2026-11-01', note: 'قسط ماه اول کانکور' }],
    },
    {
      si: 10, ei: 10, fdi: 1, title: 'فیس کورس مکالمه انگلیسی و تافل', total: 310, discount: 0, dueDate: '2026-11-29',
      payments: [{ amt: 180, method: 'bank', date: '2026-11-04', note: 'پرداخت اول دوره تافل' }],
    },
    {
      si: 11, ei: 11, fdi: 1, title: 'فیس کورس انگلیسی و آیلتس (فوج دوم)', total: 320, discount: 20, dueDate: '2026-11-15',
      payments: [{ amt: 300, method: 'cash', date: '2026-11-06', note: 'پرداخت یک‌جا همراه با تخفیف' }],
    },
  ];

  let receiptCounter = 1;
  for (const plan of feePlans) {
    const totalPaid = Math.round(plan.payments.reduce((acc, p) => acc + p.amt, 0) * 100) / 100;
    const summary = computeFeeSummary(plan.total, plan.discount, totalPaid);
    const sfId = Number(
      insertStuFee.run(
        studentIds[plan.si],
        enrollmentIds[plan.ei],
        feeDefIds[plan.fdi],
        plan.title,
        plan.total,
        plan.discount,
        totalPaid,
        plan.dueDate,
        summary.status
      ).lastInsertRowid
    );

    const stu = studentSeed[plan.si];
    for (const p of plan.payments) {
      const rcp = `RCP-2026-${String(receiptCounter).padStart(4, '0')}`;
      const payId = Number(
        insertPayment.run(
          rcp,
          sfId,
          studentIds[plan.si],
          p.amt,
          p.method,
          p.date,
          `seed-pay-${receiptCounter}`,
          p.note,
          adminId
        ).lastInsertRowid
      );
      insertIncome.run(
        `رسید فیس ${rcp}`,
        'فیس شاگردان',
        p.amt,
        p.date,
        payId,
        `${stu.first} ${stu.last} — ${plan.title}`,
        adminId
      );
      receiptCounter++;
    }
  }

  // Additional non-tuition Income Records (bringing total income_records to 16)
  insertIncome.run('فروش کتب درسی و رهنمای لابراتوار', 'مواد درسی', 240, '2026-08-25', null, 'فروش بسته کتابچه‌های عملی سمستر', adminId);
  insertIncome.run('سمینار تخصصی تحلیل داده با SQL', 'ورکشاپ‌ها', 650, '2026-09-28', null, 'ورکشاپ آخر هفته برای متخصصان', adminId);
  insertIncome.run('فروش بسته‌های آموزشی آیلتس', 'مواد درسی', 195, '2026-10-20', null, 'کتیبه‌چه‌های تمرین شنیداری و نگارش', adminId);
  insertIncome.run('برگزاری آزمون آزمایشی معیاری انگلیسی', 'امتحانات', 310, '2026-11-08', null, 'فیس اشتراک داوطلبان آزاد در آزمون آزمایشی', adminId);

  // Expense Records (12 rows across 2026-08..2026-11)
  const insertExpense = tx.prepare(
    `INSERT INTO expense_records (title, category, amount, expense_date, description, recorded_by) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const expenseSeed: Array<[string, string, number, string, string]> = [
    ['کرایه ساختمان مرکزی (اسد / آگست)', 'کرایه تعمیر', 420, '2026-08-05', 'کرایه ماهانه تعمیر آموزشی مرکز'],
    ['خرید تجهیزات شبکه و کابل‌کشی لابراتوار', 'تجهیزات', 260, '2026-08-22', 'تجهیز لابراتوار جدید با سوییچ و کابل'],
    ['کرایه ساختمان مرکزی (سنبله / سپتمبر)', 'کرایه تعمیر', 420, '2026-09-02', 'کرایه ماهانه تعمیر آموزشی مرکز'],
    ['خدمات انترنت فایبر نوری (سپتمبر)', 'مصارف خدمات', 110, '2026-09-12', 'دو خط انترنت پرسرعت برای صنف‌ها و لابراتوار'],
    ['کرایه ساختمان مرکزی (میزان / اکتوبر)', 'کرایه تعمیر', 420, '2026-10-01', 'کرایه ماهانه تعمیر آموزشی مرکز'],
    ['خدمات انترنت فایبر نوری (اکتوبر)', 'مصارف خدمات', 110, '2026-10-10', 'اشتراک ماهانه انترنت پرسرعت'],
    ['مصارف برق و تیل جنراتور', 'مصارف خدمات', 145, '2026-10-18', 'تامین برق پشتیبان در ساعات درسی'],
    ['چاپ کتیبه‌چه‌ها و اوراق امتحانات', 'قرطاسیه و چاپ', 95, '2026-10-25', 'چاپ اوراق امتحان میان‌سمستر و بروشورها'],
    ['کرایه ساختمان مرکزی (عقرب / نومبر)', 'کرایه تعمیر', 420, '2026-11-01', 'کرایه ماهانه تعمیر آموزشی مرکز'],
    ['خرید مارکر، کاغذ و لوازم تدریس', 'قرطاسیه و چاپ', 65, '2026-11-04', 'تامین لوازم تحریر تمام ده صنف'],
    ['ترمیم و سرویس پرجکتورهای صنف‌ها', 'حفظ و مراقبت', 120, '2026-11-07', 'تنظیم و تعویض لامپ پرجکتور تالار ۱۰۴'],
    ['مصارف مهمانان و نشست هماهنگی استادان', 'اداری', 75, '2026-11-10', 'نشست ارزیابی نیم‌سال اساتید'],
  ];
  for (const ex of expenseSeed) {
    insertExpense.run(ex[0], ex[1], ex[2], ex[3], ex[4], adminId);
  }

  // Salary Definitions (10 rows) & Salary Payments (12 rows)
  const insertSalDef = tx.prepare(
    `INSERT INTO salary_definitions (teacher_id, base_amount, allowance, deduction, effective_from, notes) VALUES (?, ?, ?, ?, '2026-01-01', ?)`
  );
  const insertSalPay = tx.prepare(
    `INSERT INTO salary_payments (teacher_id, pay_month, gross_amount, paid_amount, remaining_balance, payment_date, payment_method, notes, paid_by)
     VALUES (?, ?, ?, ?, ?, ?, 'bank', ?, ?)`
  );

  teacherSeed.forEach((t, idx) => {
    const allowance = idx < 3 ? 120 : 80;
    const gross = t.salary + allowance;
    insertSalDef.run(teacherIds[idx], t.salary, allowance, 0, 'شامل امتیاز مسلکی و هماهنگی لابراتوار');
    insertSalPay.run(
      teacherIds[idx],
      '2026-10',
      gross,
      gross,
      0,
      '2026-10-31',
      'معاش ماه اکتوبر تصفیه گردید',
      adminId
    );
  });
  // Two additional November/September salary payments (total 12)
  insertSalPay.run(teacherIds[0], '2026-09', 1070, 1070, 0, '2026-09-30', 'معاش ماه سپتمبر تصفیه گردید', adminId);
  insertSalPay.run(teacherIds[1], '2026-09', 1220, 1220, 0, '2026-09-30', 'معاش ماه سپتمبر تصفیه گردید', adminId);

  // ID Card Templates (2) & Issued Cards (10)
  const idTpl1Id = Number(
    tx.prepare(
      `INSERT INTO id_card_templates (name, orientation, width_mm, height_mm, bg_color, accent_color, text_color, layout_json, is_default)
       VALUES ('کارت معیاری آبی سلطنتی', 'landscape', 85.6, 54, '#ffffff', '#1e3a8a', '#0f172a', ?, 1)`
    ).run(
      JSON.stringify({
        headerTitle: 'آکادمی دانش',
        subtitle: 'کارت هویت رسمی شاگرد',
        showPhoto: true,
        showCourse: true,
        showExpiry: true,
        showQr: true,
      })
    ).lastInsertRowid
  );
  tx.prepare(
    `INSERT INTO id_card_templates (name, orientation, width_mm, height_mm, bg_color, accent_color, text_color, layout_json, is_default)
     VALUES ('کارت عمودی سبز زمردی', 'portrait', 54, 85.6, '#f8fafc', '#0f766e', '#0f172a', ?, 0)`
  ).run(
    JSON.stringify({
      headerTitle: 'آکادمی دانش',
      subtitle: 'کارت شناسایی دوره تخصصی',
      showPhoto: true,
      showCourse: true,
      showExpiry: true,
      showQr: true,
    })
  );

  const insertIdCard = tx.prepare(
    `INSERT INTO id_card_records (card_number, student_id, template_id, issue_date, expiry_date, status, issued_by)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`
  );
  for (let i = 0; i < 10; i++) {
    insertIdCard.run(
      `IDC-2026-${String(i + 1).padStart(4, '0')}`,
      studentIds[i],
      idTpl1Id,
      '2026-02-05',
      '2027-02-05',
      adminId
    );
  }

  // Certificate Templates (2) & Issued Certificates (10)
  const certTplId = Number(
    tx.prepare(
      `INSERT INTO certificate_templates (name, paper_size, orientation, bg_color, border_color, accent_color, seal_text, signature_left_label, signature_right_label, body_template, layout_json, is_default)
       VALUES ('سند رسمی فراغت و افتخار اکادمیک', 'A4', 'landscape', '#fffdf7', '#b45309', '#1e3a8a', '', 'مدیر امور اکادمیک', 'رئیس مرکز آموزشی', ?, ?, 1)`
    ).run(
      'بدین‌وسیله تصدیق می‌گردد که شاگرد گرامی {{student_name}} (کد: {{student_code}}) برنامه آموزشی {{course_title}} را در {{class_name}} با درجه {{grade_summary}} در تاریخ {{issue_date}} با موفقیت تکمیل نموده است.',
      JSON.stringify({ headerTitle: 'تصدیق‌نامه فراغت', showStudentPhoto: false, showQr: true })
    ).lastInsertRowid
  );
  tx.prepare(
    `INSERT INTO certificate_templates (name, paper_size, orientation, bg_color, border_color, accent_color, seal_text, signature_left_label, signature_right_label, body_template, layout_json, is_default)
     VALUES ('تقدیرنامه شاگردان ممتاز', 'A4', 'landscape', '#ffffff', '#0f766e', '#0f172a', '', 'استاد رهنما', 'ریاست آکادمی', ?, ?, 0)`
  ).run(
    'این تقدیرنامه به پاس تلاش و درخشش علمی شاگرد عزیز {{student_name}} ({{student_code}}) در دوره {{course_title}} با امتیاز {{grade_summary}} در تاریخ {{issue_date}} اهدا می‌گردد.',
    JSON.stringify({ headerTitle: 'تقدیرنامه افتخار', showStudentPhoto: false, showQr: true })
  );

  const insertCert = tx.prepare(
    `INSERT INTO certificates (certificate_number, student_id, course_id, class_id, template_id, issue_date, grade_summary, remarks, issued_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const certRemarks = [
    ['94% (A)', 'تقدیر برای عملکرد برجسته در مدل‌سازی سیستم‌ها'],
    ['97% (A+)', 'رتبه اول در سیستم‌های دیتابیس رابطه‌ای'],
    ['86% (A-)', 'تکمیل موفقانه دوره آیلتس و نگارش علمی'],
    ['88% (A-)', 'دقت عالی در ریاضیات گسسته و تحلیل'],
    ['84% (B+)', 'مهارت برتر در اکسل تحلیلی و اتوماسیون'],
    ['90% (A)', 'تسلط کامل در پیکربندی شبکه‌ها و امنیت'],
    ['85% (A-)', 'ارائه پروژه برتر برنامه‌نویسی پایتون'],
    ['79% (B)', 'تکمیل موفقانه مبانی حسابداری کاربردی'],
    ['93% (A)', 'طراحی برتر رابط کاربری و هویت بصری'],
    ['87% (A-)', 'پیشرفت چشمگیر در علوم ساینسی و کانکور'],
  ];
  for (let i = 0; i < 10; i++) {
    const cli = i < 10 ? i : 0;
    insertCert.run(
      `CERT-2026-${String(i + 1).padStart(4, '0')}`,
      studentIds[i],
      courseIds[classSeed[cli].ci],
      classIds[cli],
      certTplId,
      `2026-11-0${(i % 9) + 1}`,
      certRemarks[i][0],
      certRemarks[i][1],
      adminId
    );
  }

  // Notifications (10 records + recipients)
  const insertNotif = tx.prepare(
    `INSERT INTO notifications (title, message, type, target_type, link_url, created_by) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertRecip = tx.prepare(
    `INSERT OR IGNORE INTO notification_recipients (notification_id, user_id, is_read) VALUES (?, ?, ?)`
  );
  const notifSeed: Array<{
    title: string;
    msg: string;
    type: string;
    target: string;
    link: string;
    by: number;
    recips: Array<[number, number]>;
  }> = [
    {
      title: 'کارخانگی جدید: نرمال‌سازی دیتابیس فروشگاهی',
      msg: 'استاد طارق احمدی کارخانگی هفته اول را با مهلت تحویل تا ۲۰۲۶-۱۱-۲۲ ثبت نمود.',
      type: 'homework', target: 'class', link: '/student/homework', by: teacherUserIds[0],
      recips: [[studentUserIds[0], 0], [studentUserIds[1], 1], [adminId, 0]],
    },
    {
      title: 'یادآوری پرداخت قسط فیس ماهانه',
      msg: 'باقی‌مانده فیس تعلیمی به مبلغ ۱۸۰ افغانی تا تاریخ ۲۰۲۶-۱۱-۲۵ برنامه‌ریزی شده است.',
      type: 'finance', target: 'individual', link: '/student/finance', by: adminId,
      recips: [[studentUserIds[0], 0], [studentUserIds[2], 0]],
    },
    {
      title: 'اعلان انتشار نتایج امتحان میان‌سمستر',
      msg: 'نمرات امتحان میان‌سمستر دیتابیس رابطه‌ای و مقاله اکادمیک آیلتس در پورتال نشر شد.',
      type: 'exam', target: 'all_students', link: '/student/exams', by: adminId,
      recips: [[studentUserIds[0], 1], [studentUserIds[1], 0], [studentUserIds[2], 0]],
    },
    {
      title: 'به‌روزرسانی تقسیم‌اوقات لابراتوار ۲۰۱',
      msg: 'ساعت درسی روز چهارشنبه مضمون مهندسی ویب از ۰۸:۰۰ تا ۰۹:۳۰ تثبیت گردید.',
      type: 'timetable', target: 'class', link: '/student/timetable', by: adminId,
      recips: [[studentUserIds[0], 0], [teacherUserIds[0], 1]],
    },
    {
      title: 'نشست ماهانه شورای اساتید مرکز آموزشی',
      msg: 'از تمام استادان گرامی دعوت می‌شود روز پنج‌شنبه ساعت ۱۴:۰۰ در سالون جلسات حضور یابند.',
      type: 'info', target: 'all_teachers', link: '/teacher/notifications', by: adminId,
      recips: [[teacherUserIds[0], 0], [teacherUserIds[1], 0], [teacherUserIds[2], 0]],
    },
    {
      title: 'ثبت کارخانگی جدید در مضمون آیلتس',
      msg: 'مقاله تحلیلی آموزش دوزبانه در سیستم ثبت شد؛ لطفاً تا مهلت مقرر ارسال نمایید.',
      type: 'homework', target: 'class', link: '/student/homework', by: teacherUserIds[1],
      recips: [[studentUserIds[2], 0], [studentUserIds[11], 0]],
    },
    {
      title: 'صادر شدن کارت هویت جدید شاگردان',
      msg: 'کارت‌های هویت دوره ۱۴۰۵ آماده تحویل از دفتر ثبت‌نام و پذیرش می‌باشد.',
      type: 'system', target: 'all_students', link: '/student/profile', by: adminId,
      recips: [[studentUserIds[0], 1], [studentUserIds[3], 0], [studentUserIds[4], 0]],
    },
    {
      title: 'اعلان تخفیف ویژه ثبت‌نام سمستر بعدی',
      msg: 'شاگردان ممتاز با معدل بالای ۹۰ درصد از ۲۰ درصد تخفیف سمستر بعدی بهره‌مند می‌شوند.',
      type: 'info', target: 'all_users', link: '/student', by: adminId,
      recips: [[studentUserIds[1], 0], [studentUserIds[5], 0], [adminId, 1]],
    },
    {
      title: 'ارسال کارخانگی توسط شاگردان برای بررسی',
      msg: 'پاسخ‌های جدید شاگردان در بخش کارخانگی منتظر نمره‌دهی شما است.',
      type: 'homework', target: 'individual', link: '/teacher/homework', by: adminId,
      recips: [[teacherUserIds[0], 0], [teacherUserIds[1], 0], [teacherUserIds[2], 0]],
    },
    {
      title: 'تهیه نسخه پشتیبان منظم سیستم',
      msg: 'به مدیر سیستم یادآوری می‌شود قبل از تغییرات عمده از دیتابیس نسخه پشتیبان تهیه گردد.',
      type: 'system', target: 'individual', link: '/admin/backups', by: adminId,
      recips: [[adminId, 0]],
    },
  ];
  for (const n of notifSeed) {
    const nid = Number(insertNotif.run(n.title, n.msg, n.type, n.target, n.link, n.by).lastInsertRowid);
    for (const [uid, isRead] of n.recips) {
      insertRecip.run(nid, uid, isRead);
    }
  }

  // Conversations (10) & Messages (22)
  const insertConv = tx.prepare(`INSERT INTO conversations (subject) VALUES (?)`);
  const insertPart = tx.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`);
  const insertMsg = tx.prepare(`INSERT INTO messages (conversation_id, sender_id, body, is_read) VALUES (?, ?, ?, ?)`);

  const convSeed: Array<{ subject: string; u1: number; u2: number; msgs: Array<[number, string, number]> }> = [
    {
      subject: 'بررسی ساختار دیتابیس پروژه میان‌سمستر',
      u1: studentUserIds[0], u2: teacherUserIds[0],
      msgs: [
        [studentUserIds[0], 'سلام استاد احمدی، آیا در پروژه باید جدول فیس شاگردان و پرداخت‌ها را از هم جدا کنیم؟', 1],
        [teacherUserIds[0], 'بله احمدالله جان! جدول student_fees را برای تعهد مالی و جدول payments را به عنوان دفتر ثبت غیرقابل تغییر نگه دارید.', 0],
      ],
    },
    {
      subject: 'هماهنگی تایم مشوره مقاله آیلتس',
      u1: studentUserIds[2], u2: teacherUserIds[1],
      msgs: [
        [studentUserIds[2], 'سلام استاد سادات، امکان دارد پیش‌نویس مقاله را فردا در وقت تفریح مرور کنید؟', 1],
        [teacherUserIds[1], 'حتماً امید جان، ساعت ۱۱:۳۰ در اتاق اساتید منتظر شما هستم.', 1],
      ],
    },
    {
      subject: 'درخواست رسید چاپی قسط دوم فیس',
      u1: studentUserIds[0], u2: adminId,
      msgs: [
        [studentUserIds[0], 'سلام مدیر صاحب، لطفاً نسخه تائیدشده رسید فیس ماه میزان را در پورتال برایم فعال سازید.', 1],
        [adminId, 'سلام احمدالله جان، رسید شماره RCP-2026-0002 هم‌اکنون در بخش مالی پورتال شما قابل چاپ است.', 0],
      ],
    },
    {
      subject: 'تجهیز لابراتوار شبکه‌های کمپیوتری',
      u1: teacherUserIds[2], u2: adminId,
      msgs: [
        [teacherUserIds[2], 'لطفاً پنج عدد کیبل شبکه و دو دستگاه سوییچ تمرینی برای صنف پنجم تهیه شود.', 1],
        [adminId, 'تائید شد استاد نظری، بودجه تجهیزات منظور شده و تا شنبه در لابراتوار قرار می‌گیرد.', 1],
      ],
    },
    {
      subject: 'نتیجه امتحان عملی پایتون',
      u1: studentUserIds[1], u2: teacherUserIds[3],
      msgs: [
        [studentUserIds[1], 'سلام استاد وردک، تشکر بابت نمره ۹۵ و رهنمایی‌های دقیق شما.', 1],
        [teacherUserIds[3], 'آفرین فاطمه جان، پروژه الگوریتم شما بسیار منظم بود.', 1],
      ],
    },
    {
      subject: 'گزارش حاضری ماهانه صنف چهارم',
      u1: teacherUserIds[8], u2: adminId,
      msgs: [
        [teacherUserIds[8], 'تمام حاضری‌های هفته گذشته صنف کمپیوتر و اکسل در سیستم ثبت و بروزرسانی شد.', 1],
        [adminId, 'سپاس استاد غفاری، گزارش حاضری در داشبورد ثبت گردید.', 1],
      ],
    },
    {
      subject: 'پرسش درباره تراز آزمایشی حسابداری',
      u1: studentUserIds[7], u2: teacherUserIds[4],
      msgs: [
        [studentUserIds[7], 'سلام استاد رحیمی، در بخش مصارف پیش‌پرداخت تراز آزمایشی کمی تردید دارم.', 1],
        [teacherUserIds[4], 'در آغاز درس بعدی یک مثال کامل روی تخته کار می‌کنیم تا کاملاً واضح شود.', 0],
      ],
    },
    {
      subject: 'ارسال فایل لایه‌باز پوستر سمینار',
      u1: studentUserIds[8], u2: teacherUserIds[6],
      msgs: [
        [studentUserIds[8], 'استاد کریمی، پوستر طراحی‌شده را به بخش کارخانگی آپلود کردم.', 1],
        [teacherUserIds[6], 'بسیار خوب سهراب جان، تا عصر امروز بررسی و نمره‌دهی می‌شود.', 1],
      ],
    },
    {
      subject: 'آماده‌سازی سوالات آزمون آزمایشی کانکور',
      u1: teacherUserIds[7], u2: adminId,
      msgs: [
        [teacherUserIds[7], 'بانک سوالات فزیک و ریاضی برای آزمون ماه عقرب نهایی گردید.', 1],
        [adminId, 'عالی است استاد رسولی، هماهنگی چاپ اوراق انجام می‌شود.', 1],
      ],
    },
    {
      subject: 'مشاوره ثبت‌نام در دوره مکالمه پیشرفته',
      u1: studentUserIds[10], u2: teacherUserIds[9],
      msgs: [
        [studentUserIds[10], 'سلام استاد علی‌زاده، برای تقویت لهجه کدام کتاب کمکی را پیشنهاد می‌کنید؟', 1],
        [teacherUserIds[9], 'جزوه تمرین شنیداری هفته اول در بخش اسناد پورتال بارگذاری شده است.', 1],
        [studentUserIds[10], 'بسیار تشکر استاد گرامی، حتماً دانلود و مطالعه می‌کنم.', 1],
      ],
    },
  ];

  for (const c of convSeed) {
    const cid = Number(insertConv.run(c.subject).lastInsertRowid);
    insertPart.run(cid, c.u1);
    insertPart.run(cid, c.u2);
    for (const [sender, body, isRead] of c.msgs) {
      insertMsg.run(cid, sender, body, isRead);
    }
  }

  // Documents (10 records backed by actual files in storage/uploads)
  const uploadFiles = ensureSeedUploadFiles();
  const docSeed: Array<[string, string, number | null, number | null, number | null, string, string]> = [
    ['نصاب درسی مهندسی ویب و سیستم‌های معلوماتی', 'syllabus', teacherUserIds[0], null, teacherIds[0], uploadFiles[0], 'نصاب-مهندسی-ویب.txt'],
    ['مقرره حاضری و انضباط اکادمیک مرکز', 'policy', adminId, null, null, uploadFiles[1], 'مقرره-حاضری.txt'],
    ['رهنمای آمادگی امتحان آیلتس و نگارش علمی', 'syllabus', teacherUserIds[1], null, teacherIds[1], uploadFiles[2], 'رهنمای-آیلتس.txt'],
    ['جزوه عملی برنامه‌نویسی پایتون و ساختار داده‌ها', 'material', teacherUserIds[3], null, teacherIds[3], uploadFiles[3], 'جزوه-پایتون.txt'],
    ['کتیبه‌چه رهنمای شاگردان آکادمی دانش', 'general', adminId, studentIds[0], null, uploadFiles[4], 'رهنمای-شاگردان.txt'],
    ['لایحه امتحانات میان‌سمستر و سیستم نمرات', 'policy', adminId, null, null, uploadFiles[5], 'لایحه-امتحانات.txt'],
    ['طرزالعمل پرداخت فیس و صدور رسید رسمی', 'finance', adminId, studentIds[1], null, uploadFiles[6], 'طرزالعمل-مالی.txt'],
    ['سناریوی عملی لابراتوار شبکه‌های کمپیوتری', 'material', teacherUserIds[2], null, teacherIds[2], uploadFiles[7], 'لابراتوار-شبکه.txt'],
    ['مجموعه تمرین‌های ریاضیات گسسته و جبر خطی', 'material', teacherUserIds[1], studentIds[3], null, uploadFiles[8], 'تمرین-ریاضیات.txt'],
    ['تقویم رسمی اکادمیک سال ۱۴۰۵ آکادمی دانش', 'general', adminId, null, null, uploadFiles[9], 'تقویم-اکادمیک.txt'],
  ];
  const insertDoc = tx.prepare(
    `INSERT INTO documents (title, category, owner_user_id, student_id, teacher_id, file_path, original_name, mime_type, file_size, is_archived, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'text/plain', ?, 0, ?)`
  );
  for (const d of docSeed) {
    const fileFull = path.join(UPLOADS_DIR, d[5]);
    const size = fs.existsSync(fileFull) ? fs.statSync(fileFull).size : 128;
    insertDoc.run(d[0], d[1], d[2], d[3], d[4], `/api/admin/files/${d[5]}`, d[6], size, d[2] ?? adminId);
  }

  // Website Sliders (10 records; first 4 active in hero carousel, 6 seasonal/draft)
  const insertSlider = tx.prepare(
    `INSERT INTO website_sliders (title, subtitle, button_label, button_url, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const sliderSeed: Array<[string, string, string, string, string, number, number]> = [
    [
      'آموزش معیاری و تخصصی برای آینده شغلی درخشان',
      'دوره‌های منظم مهندسی نرم‌افزار، علوم ساینسی و زبان انگلیسی با تدریس اساتید مجرب و ظرفیت محدود صنف‌ها.',
      'مشاهده کورس‌ها', '#courses', '/src/assets/images/hero_academy_campus_1794554062936.jpg', 1, 1,
    ],
    [
      'لابراتوارهای مجهز و رهنمایی مستقیم استادان',
      'جلسات عملی روزانه، سیستم دقیق حاضری و گزارش‌دهی شفاف پیشرفت اکادمیک برای شاگردان و خانواده‌ها.',
      'معرفی اساتید', '#teachers', '/src/assets/images/hero_science_lab_1794554063311.jpg', 2, 1,
    ],
    [
      'اسناد و تصدیق‌نامه‌های معتبر با شماره سریال یکتا',
      'فارغان آکادمی دانش پس از ارزیابی‌های دقیق، تصدیق‌نامه رسمی و کارت هویت دیجیتال دریافت می‌کنند.',
      'گالری و افتخارات', '#gallery', '/src/assets/images/gallery_graduation_1794554064196.jpg', 3, 1,
    ],
    [
      'نصاب درسی دوزبانه و هم‌سو با معیارهای بین‌المللی',
      'برنامه‌ریزی بدون تداخل زمانی، تمرین‌های عملی هفته به هفته و آزمون‌های معیاری میان‌سمستر.',
      'درباره آکادمی', '#about', '/src/assets/images/hero_academy_campus_1794554062936.jpg', 4, 1,
    ],
    [
      'دوره‌های ویژه آمادگی آیلتس و تافل',
      'تقویت چهار مهارت زبان انگلیسی با اساتید دارای مدرک بین‌المللی.',
      'مشاهده کورس‌ها', '#courses', '/src/assets/images/hero_science_lab_1794554063311.jpg', 5, 0,
    ],
    [
      'کارگاه‌های علمی برنامه‌نویسی پایتون و دیتابیس',
      'پروژه‌های واقعی در محیط لابراتوار و آموزش اصول مهندسی نرم‌افزار.',
      'مشاهده کورس‌ها', '#courses', '/src/assets/images/hero_science_lab_1794554063311.jpg', 6, 0,
    ],
    [
      'حسابداری کاربردی و مدیریت مالی مدرن',
      'آموزش مهارت‌های مورد نیاز بازار کار در دفاتر مالی و شرکت‌ها.',
      'مشاهده کورس‌ها', '#courses', '/src/assets/images/gallery_graduation_1794554064196.jpg', 7, 0,
    ],
    [
      'جشن فراغت و تقدیر از شاگردان ممتاز سالانه',
      'تجلیل از دستاوردهای علمی شاگردان برتر در حضور خانواده‌ها و کادر علمی.',
      'شاگردان ممتاز', '#gallery', '/src/assets/images/gallery_graduation_1794554064196.jpg', 8, 0,
    ],
    [
      'پذیرش دوره جدید شبکه‌های کمپیوتری و امنیت',
      'تجربه عملی روی تجهیزات شبکه و سناریوهای امنیتی.',
      'تماس با ما', '#contact', '/src/assets/images/hero_academy_campus_1794554062936.jpg', 9, 0,
    ],
    [
      'ثبت‌نام سمستر تابستانی و تقویتی کانکور',
      'پشتیبانی ویژه مضامین ریاضی، فزیک و کیمیا توسط اساتید مجرب.',
      'ورود', '/login', '/src/assets/images/hero_science_lab_1794554063311.jpg', 10, 0,
    ],
  ];
  for (const sl of sliderSeed) {
    insertSlider.run(...sl);
  }

  // Website Sections (About & Why Choose Us in Dari)
  const insertSection = tx.prepare(
    `INSERT INTO website_sections (section_key, title, subtitle, content_html, is_visible, sort_order, meta_json) VALUES (?, ?, ?, ?, 1, ?, ?)`
  );
  insertSection.run(
    'about',
    'آموزش ساختاریافته بر محور مهارت واقعی',
    'درباره آکادمی دانش',
    '<p>آکادمی دانش در سال ۲۰۱۹ در شهر کابل بنیان‌گذاری شد و به عنوان یک مرکز آموزشی معتبر در زمینه تدریس تکنالوژی معلوماتی، زبان‌های خارجی، علوم ساینسی و مهارت‌های مسلکی فعالیت می‌نماید.</p><p><strong>ماموریت ما:</strong> ارائه آموزش منظم و عملی در صنف‌های کم‌جمعیت با نظارت مستقیم اساتید، ارزیابی شفاف و اسناد معتبر اکادمیک.</p><p><strong>چشم‌انداز ما:</strong> تبدیل شدن به الگوی برتر مراکز آموزشی در کشور از طریق نصاب به‌روز و پرورش نسل متخصص و متعهد.</p>',
    1,
    JSON.stringify({
      history: 'تاسیس‌شده در سال ۲۰۱۹ با سه صنف درسی و اکنون دارای لابراتوارهای مجهز کمپیوتر، شبکه و تالارهای سمینار با بیش از ۴۰۰ فارغ موفق.',
      mission: 'ارائه آموزش معیاری، منضبط و کاربردی همراه با شفافیت کامل در نمرات، حاضری و امور مالی.',
      vision: 'توانمندسازی شاگردان با مهارت‌های قابل سنجش در مهندسی نرم‌افزار، ریاضیات، اقتصاد و زبان‌های بین‌المللی.',
      objectives: 'حفظ ظرفیت معیاری صنف‌ها، ارائه بازخورد سریع بر کارخانگی‌ها و پشتیبانی کامل از یادگیری چندزبانه در محیط امن علمی.',
      values: [
        { title: 'اصالت و کیفیت علمی', description: 'پایبندی دقیق به نصاب درسی به‌روز، تدریس مفهومی و تمرین‌های عملی در لابراتوار.' },
        { title: 'شفافیت و پاسخ‌گویی', description: 'ثبت منظم حاضری، نمرات امتحانات و اسناد مالی برای دسترسی مستقیم شاگردان و خانواده‌ها.' },
        { title: 'انضباط و محیط امن اکادمیک', description: 'صنف‌های با ظرفیت محدود، نظارت مستقیم اساتید و رعایت اصول اخلاق آموزشی.' },
        { title: 'پشتیبانی چندزبانه و فراگیر', description: 'ارائه آموزش و خدمات اداری هم‌سو با نیازهای محلی به پنج زبان ملی و بین‌المللی.' },
      ],
    })
  );
  insertSection.run(
    'why_choose_us',
    'چرا خانواده‌ها و شاگردان آکادمی دانش را انتخاب می‌کنند؟',
    'معیارهای نهادی ما',
    '',
    2,
    JSON.stringify({
      cards: [
        { title: 'اساتید مجرب و متخصص', description: 'تمامی استادان دارای مدارک عالی اکادمیک بوده و در صنف‌های با ظرفیت محدود تدریس می‌نمایند.' },
        { title: 'تقسیم‌اوقات منظم و بدون تداخل', description: 'برنامه‌ریزی دقیق هفته‌وار برای صنف‌ها، لابراتوارها و تالارها بدون هیچ‌گونه هم‌پوشانی زمانی.' },
        { title: 'شفافیت کامل در نمرات و مالی', description: 'شاگردان در هر لحظه به کارنامه امتحانات، حاضری، کارخانگی‌ها و رسیدهای فیس خود دسترسی دارند.' },
        { title: 'تصدیق‌نامه‌ها و کارت‌های معتبر', description: 'فارغان و شاگردان دارای تصدیق‌نامه با شماره سریال رسمی و کارت هویت معیاری مرکز می‌گردند.' },
      ],
    })
  );

  // Website Pages (10 pages in Dari)
  const insertPage = tx.prepare(
    `INSERT INTO website_pages (slug, title, content_html, is_published, is_system) VALUES (?, ?, ?, ?, ?)`
  );
  const pageSeed: Array<[string, string, string, number, number]> = [
    ['academic-calendar', 'تقویم اکادمیک ۱۴۰۵ / ۲۰۲۶', '<h2>جدول زمانی سمستر ۱۴۰۵</h2><p>آغاز دوره‌های بهاری از اول فبروری ۲۰۲۶ می‌باشد. امتحانات میان‌سمستر در اواخر اکتوبر و دفاع پروژه‌های نهایی در ماه دسمبر برگزار می‌گردد.</p><ul><li>حداقل حاضری مجاز برای امتحان نهایی: ۸۰٪</li><li>اقساط فیس مطابق جدول دفتر مالی مدیریت می‌شود.</li></ul>', 0, 0],
    ['admissions-policy', 'مقرره پذیرش و ثبت‌نام شاگردان', '<h2>پذیرش منظم و ارزیابی سطح</h2><p>به منظور حفظ کیفیت تدریس و تناسب مناسب تعداد شاگردان، تمامی حساب‌های کاربری و ثبت‌نام صنف‌ها مستقیماً توسط مدیریت امور اکادمیک انجام می‌شود.</p>', 1, 1],
    ['scholarships-and-discounts', 'بورس‌ها و تخفیف‌های تشویقی', '<h2>حمایت از استعدادهای برتر</h2><p>شاگردان ممتاز هر دوره که معدل بالاتر از ۹۰ درصد کسب نمایند از تخفیف ویژه سمستر بعدی بهره‌مند می‌گردند.</p>', 1, 0],
    ['computer-lab-rules', 'رهنمای استفاده از لابراتوار کمپیوتر', '<h2>مقررات لابراتوارهای تخصصی</h2><p>لابراتوارها روزانه از ساعت ۰۸:۰۰ تا ۱۶:۰۰ برای تمرین عملی و کارهای گروهی شاگردان فعال است.</p>', 1, 0],
    ['exam-and-grading-guide', 'سیستم امتحانات و درجه‌بندی نمرات', '<h2>شفافیت کامل ارزیابی</h2><p>نمرات بر اساس مقیاس ۰ تا ۱۰۰ محاسبه شده و به درجات A+ تا F تبدیل می‌گردند. حداقل نمره کامیابی ۵۰ درصد است.</p>', 1, 0],
    ['library-and-resources', 'کتابخانه و منابع دیجیتال', '<h2>دسترسی به کتب و مقالات</h2><p>بخش اسناد پورتال شامل جزوه‌ها، نصاب درسی و تمرین‌های هر مضمون برای استفاده رایگان شاگردان می‌باشد.</p>', 1, 0],
    ['student-code-of-conduct', 'لایحه انضباطی و اخلاق اکادمیک', '<h2>محیط علمی محترمانه</h2><p>احترام متقابل، حضور به موقع در صنف و رعایت اصالت علمی در انجام کارخانگی‌ها الزامی است.</p>', 1, 0],
    ['career-counseling', 'مرکز رهنمایی شغلی و کارآموزی', '<h2>پیوند آموزش با بازار کار</h2><p>فارغان ممتاز دوره‌های دیپلوم به شرکت‌های همکار جهت کارآموزی معرفی می‌شوند.</p>', 1, 0],
    ['parent-portal-guide', 'اطلاعات برای والدین و اولیای گرامی', '<h2>همکاری خانواده و آکادمی</h2><p>خانواده‌ها می‌توانند وضعیت حاضری، پیشرفت درسی و پرداخت‌های مالی فرزندان خود را پیگیری کنند.</p>', 1, 0],
    ['faq-admissions', 'سوالات متداول داوطلبان', '<h2>پاسخ به پرسش‌های رایج</h2><p>برای دریافت معلومات بیشتر در مورد ثبت‌نام و زمان‌بندی کورس‌ها با شماره تلفن پذیرش تماس بگیرید.</p>', 1, 0],
  ];
  for (const pg of pageSeed) {
    insertPage.run(...pg);
  }

  // Website Menus (Public primary links; academic calendar intentionally omitted from public navigation)
  const insertMenu = tx.prepare(
    `INSERT INTO website_menus (label, url, target_page_slug, sort_order, is_visible, is_essential) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const menuSeed: Array<[string, string, string, number, number, number]> = [
    ['کورس‌ها', '/courses', '', 1, 1, 1],
    ['اساتید', '/teachers', '', 2, 1, 1],
    ['گالری', '/gallery', '', 3, 1, 1],
    ['درباره ما', '/about', '', 4, 1, 1],
    ['تماس با ما', '#contact', '', 5, 1, 1],
    ['مقرره پذیرش', '/page/admissions-policy', 'admissions-policy', 7, 0, 0],
    ['بورس‌ها و تخفیف‌ها', '/page/scholarships-and-discounts', 'scholarships-and-discounts', 8, 0, 0],
    ['سیستم امتحانات', '/page/exam-and-grading-guide', 'exam-and-grading-guide', 9, 0, 0],
    ['سوالات متداول', '/page/faq-admissions', 'faq-admissions', 10, 0, 0],
  ];
  for (const m of menuSeed) {
    insertMenu.run(...m);
  }

  // Gallery Categories (4) & Gallery Media (12)
  const insertGCat = tx.prepare(`INSERT INTO gallery_categories (name, slug) VALUES (?, ?)`);
  const gCatIds = [
    Number(insertGCat.run('محوطه و لابراتوارها', 'campus-labs').lastInsertRowid),
    Number(insertGCat.run('جشن فراغت و جوایز', 'convocation').lastInsertRowid),
    Number(insertGCat.run('سمینارها و ورکشاپ‌ها', 'seminars').lastInsertRowid),
    Number(insertGCat.run('فعالیت‌های علمی شاگردان', 'student-projects').lastInsertRowid),
  ];

  const insertGallery = tx.prepare(
    `INSERT INTO gallery_media (category_id, title, description, media_type, file_url, is_published) VALUES (?, ?, ?, 'image', ?, 1)`
  );
  const gallerySeed: Array<[number, string, string, string]> = [
    [0, 'حیاط اصلی و ساختمان مرکزی آکادمی', 'ورود شاگردان به ساختمان اصلی آکادمی دانش در کابل.', '/src/assets/images/hero_academy_campus_1794554062936.jpg'],
    [0, 'لابراتوار تخصصی کمپیوتر و مهندسی نرم‌افزار', 'جلسه عملی معماری سیستم‌ها در لابراتوار ۲۰۱.', '/src/assets/images/hero_science_lab_1794554063311.jpg'],
    [1, 'مراسم سالانه تقدیر از فارغان ممتاز', 'اهدای تصدیق‌نامه‌ها به شاگردان برتر دوره‌های دیپلوم.', '/src/assets/images/gallery_graduation_1794554064196.jpg'],
    [2, 'کارگاه طراحی دیتابیس‌های رابطه‌ای', 'تحلیل و طراحی عملی ساختار داده‌ها با حضور اساتید.', '/src/assets/images/hero_science_lab_1794554063311.jpg'],
    [3, 'ارائه پروژه‌های پایانی شاگردان پایتون', 'دفاع گروهی از اپلیکیشن‌های تحلیلی ساخته شده توسط شاگردان.', '/src/assets/images/hero_academy_campus_1794554062936.jpg'],
    [1, 'توزیع جوایز برگزیدگان آزمون آیلتس', 'تجلیل از نمرات برتر آزمون آزمایشی بین‌المللی.', '/src/assets/images/gallery_graduation_1794554064196.jpg'],
    [0, 'تالار سمینارها و جلسات علمی', 'فضای استاندارد و آرام برای برگزاری کنفرانس‌های آموزشی.', '/src/assets/images/hero_academy_campus_1794554062936.jpg'],
    [2, 'سمینار آشنایی با شبکه‌های کمپیوتری و امنیت', 'تمرین گروهی پیکربندی تجهیزات شبکه در لابراتوار.', '/src/assets/images/hero_science_lab_1794554063311.jpg'],
    [3, 'نشست حل تمرین ریاضیات تحلیلی', 'همکاری تیمی شاگردان برای حل مسائل المپیاد ریاضی.', '/src/assets/images/hero_academy_campus_1794554062936.jpg'],
    [1, 'عکس یادگاری دوره اول مهندسی ویب', 'جمع‌بندی دوره ۲۴ هفته‌ای همراه با اساتید رهنما.', '/src/assets/images/gallery_graduation_1794554064196.jpg'],
    [2, 'ورکشاپ مهارت‌های نگارش اکادمیک دری و انگلیسی', 'آموزش فنون پژوهش و استناددهی علمی.', '/src/assets/images/hero_science_lab_1794554063311.jpg'],
    [3, 'نمایشگاه آثار طراحی گرافیک و رابط کاربری', 'معرفی پوسترها و نمونه‌کارهای استودیو دیزاین.', '/src/assets/images/gallery_graduation_1794554064196.jpg'],
  ];
  for (const g of gallerySeed) {
    insertGallery.run(gCatIds[g[0]], g[1], g[2], g[3]);
  }

  // Featured Top Students (10 records; first 4 published by default for curated homepage showcase)
  const insertFeatured = tx.prepare(
    `INSERT INTO featured_students (student_id, achievement_title, achievement_detail, display_photo_url, is_published, sort_order)
     VALUES (?, ?, ?, '', ?, ?)`
  );
  const featSeed: Array<[number, string, string, number]> = [
    [1, 'رتبه اول — مهندسی نرم‌افزار فول‌استک', 'کسب ۹۷٪ نمره در طراحی دیتابیس رابطه‌ای و سیستم‌های تراکنشی', 1],
    [0, 'شاگرد ممتاز — مدل‌سازی سیستم‌ها', 'کسب ۹۴٪ در امتحان میان‌سمستر و همکار لابراتوار', 2],
    [2, 'برتر علمی — زبان انگلیسی و آیلتس', 'عملکرد برجسته در نگارش مقاله اکادمیک با امتیاز ۸۶٪', 3],
    [3, 'ممتاز ریاضیات — تحلیل عددی و گسسته', 'حل برتر مسائل ترکیبیات و منطق ریاضی', 4],
    [5, 'برتر تخصصی — شبکه‌های کمپیوتری و امنیت', 'کسب نمره ۹۰٪ در پیکربندی عملی شبکه‌ها', 5],
    [6, 'مبتکر پروژه — برنامه‌نویسی پایتون', 'طراحی الگوریتم بهینه در پروژه مدیریت کتابخانه', 6],
    [8, 'طراح برتر — گرافیک دیزاین و UI', 'کسب ۹۳٪ در پروژه هویت بصری و طراحی رابط کاربری', 7],
    [9, 'ممتاز ساینس — آمادگی ویژه کانکور', 'برترین نمره در آزمون آزمایشی فزیک و ریاضیات', 8],
    [11, 'رتبه ممتاز — نگارش علمی آیلتس', 'کسب امتیاز ۹۱٪ در ارزیابی مهارت‌های تحلیلی زبان', 9],
    [4, 'برگزیده عملی — اتوماسیون دفتری و اکسل', 'دقت عالی در تهیه گزارش‌های مالی و اکسل پیشرفته', 10],
  ];
  for (const f of featSeed) {
    insertFeatured.run(studentIds[f[0]], f[1], f[2], f[3] <= 4 ? 1 : 0, f[3]);
  }

  // Website Settings (Dari)
  const insertWebSet = tx.prepare(`INSERT INTO website_settings (key, value) VALUES (?, ?)`);
  const webSettingsSeed: Array<[string, string]> = [
    ['site_name', 'آکادمی دانش'],
    ['site_tagline', 'مرکز تخصصی علوم کاربردی، زبان‌های خارجی و مهندسی نرم‌افزار'],
    ['site_logo_url', ''],
    ['slider_interval_ms', '6000'],
    ['contact_phone', '+93 20 250 4800'],
    ['contact_email', 'admissions@danesh.edu'],
    ['contact_address', 'سرک چهارم کارته چهار، ناحیه سوم، کابل، افغانستان'],
    ['map_embed_note', '۳۴.۵۱۰۵° شمالی، ۶۹.۱۳۸۰° شرقی · دروازه اصلی محوطه آکادمی'],
    ['social_facebook', 'https://facebook.com/daneshacademy'],
    ['social_telegram', 'https://t.me/daneshacademy'],
    ['social_linkedin', 'https://linkedin.com/school/daneshacademy'],
    ['footer_text', '© ۱۴۰۵ آکادمی دانش. تمامی سوابق اکادمیک به صورت رسمی در سیستم ثبت می‌گردد.'],
  ];
  for (const [k, v] of webSettingsSeed) {
    insertWebSet.run(k, v);
  }

  // System Settings (default_language = 'fa')
  const insertSysSet = tx.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?)`);
  insertSysSet.run('default_language', 'fa');
  insertSysSet.run('currency_symbol', 'AFN');
  insertSysSet.run('session_timeout_minutes', '120');
  insertSysSet.run('max_upload_mb', '25');
  insertSysSet.run('academic_year', '2026');
  insertSysSet.run('seed_version', SEED_VERSION);
  insertSysSet.run('v3_afn_branding_cleanup_migrated', '1');

  // Reminder Jobs (4 system scheduler jobs with Dari titles)
  const insertRem = tx.prepare(
    `INSERT INTO reminder_jobs (job_type, title, schedule_cron, is_enabled, days_before) VALUES (?, ?, ?, 1, ?)`
  );
  insertRem.run('homework_due', 'یادآوری مهلت ارسال کارخانگی‌ها', '0 8 * * *', 3);
  insertRem.run('homework_overdue', 'هشدار کارخانگی‌های تاخیردار', '0 9 * * *', 0);
  insertRem.run('fee_due', 'یادآوری پرداخت فیس‌های معوقه', '0 10 * * 1', 7);
  insertRem.run('exam_upcoming', 'اطلاع‌رسانی امتحانات پیش‌رو', '0 7 * * *', 5);

  // Audit Logs (12 records in Dari/technical codes)
  const insertAudit = tx.prepare(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_ref, result, details_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, 'success', ?, '127.0.0.1')`
  );
  const auditSeed: Array<[number, string, string, string, string, string, string]> = [
    [adminId, 'admin', 'admin', 'SYSTEM_INITIALIZED', 'system', 'dari_10x_seed', 'راه‌اندازی اولیه دیتابیس با داده‌های نمونه دری'],
    [adminId, 'admin', 'admin', 'TEACHERS_REGISTERED', 'teachers', 'TCH-0001..0010', 'ثبت ۱۰ استاد متخصص در کادر علمی مرکز'],
    [adminId, 'admin', 'admin', 'STUDENTS_ENROLLED', 'students', 'STU-0001..0012', 'ثبت‌نام ۱۲ شاگرد و تخصیص صنف‌های درسی'],
    [adminId, 'admin', 'admin', 'TIMETABLE_VERIFIED', 'timetable', '14-slots', 'تایید ۱۴ ساعت درسی بدون هیچ تداخل زمانی'],
    [adminId, 'admin', 'admin', 'EXAMS_PUBLISHED', 'exams', 'EX-0001..0009', 'نشر نمرات امتحانات میان‌سمستر در پورتال شاگردان'],
    [adminId, 'admin', 'admin', 'PAYMENT_RECORDED', 'finance', 'RCP-2026-0001', 'ثبت پرداخت فیس شاگرد احمدالله رحیمی'],
    [adminId, 'admin', 'admin', 'PAYMENT_RECORDED', 'finance', 'RCP-2026-0002', 'تصفیه کامل فیس شاگرد فاطمه محمدی'],
    [adminId, 'admin', 'admin', 'SALARY_PAID', 'salaries', '2026-10', 'پرداخت معاشات ماه اکتوبر اساتید مرکز'],
    [adminId, 'admin', 'admin', 'ID_CARDS_ISSUED', 'id_cards', 'IDC-2026-0001..0010', 'صدور ۱۰ کارت هویت رسمی برای شاگردان'],
    [adminId, 'admin', 'admin', 'CERTIFICATES_ISSUED', 'certificates', 'CERT-2026-0001..0010', 'صدور ۱۰ تصدیق‌نامه با شماره سریال یکتا'],
    [adminId, 'admin', 'admin', 'CMS_CONTENT_UPDATED', 'website', 'dari_portal', 'تنظیم محتوای وب‌سایت عمومی آکادمی به زبان دری'],
    [adminId, 'admin', 'admin', 'SYSTEM_SETTINGS_UPDATED', 'settings', 'default_lang:fa', 'تعیین زبان دری به عنوان زبان پیش‌فرض سیستم'],
  ];
  for (const a of auditSeed) {
    insertAudit.run(a[0], a[1], a[2], a[3], a[4], a[5], JSON.stringify({ note: a[6] }));
  }
  tx.prepare(`INSERT INTO system_settings (key, value) VALUES ('public_cms_v2_migrated', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`).run();
}

function applyPublicCmsV2Migration(db: DatabaseSync): void {
  const flag = db
    .prepare(`SELECT value FROM system_settings WHERE key = 'public_cms_v2_migrated'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  runTransaction((tx) => {
    // 1. Remove academic-calendar from public navigation menus and unpublish it from public website pages
    tx.prepare(`DELETE FROM website_menus WHERE target_page_slug = 'academic-calendar' OR url LIKE '%academic-calendar%'`).run();
    tx.prepare(`UPDATE website_pages SET is_published = 0 WHERE slug = 'academic-calendar'`).run();

    // Update anchor menu items to dedicated listing routes if they still point to old hash anchors
    tx.prepare(`UPDATE website_menus SET url = '/courses' WHERE url = '#courses'`).run();
    tx.prepare(`UPDATE website_menus SET url = '/teachers' WHERE url = '#teachers'`).run();
    tx.prepare(`UPDATE website_menus SET url = '/gallery' WHERE url = '#gallery'`).run();
    tx.prepare(`UPDATE website_menus SET url = '/about' WHERE url = '#about'`).run();

    // 2. Default featured_on_home = 1 on first 4 active public teachers if none are flagged yet
    const featuredTeachersCnt = (
      tx.prepare(`SELECT COUNT(*) AS cnt FROM teachers WHERE featured_on_home = 1`).get() as { cnt: number }
    ).cnt;
    if (featuredTeachersCnt === 0) {
      tx.prepare(
        `UPDATE teachers SET featured_on_home = 1
         WHERE id IN (SELECT id FROM teachers WHERE status = 'active' AND show_on_website = 1 ORDER BY id ASC LIMIT 4)`
      ).run();
    }

    // 3. Curate default featured students (keep top 4 published if all 10 were initially published)
    const publishedStudentsCnt = (
      tx.prepare(`SELECT COUNT(*) AS cnt FROM featured_students WHERE is_published = 1`).get() as { cnt: number }
    ).cnt;
    if (publishedStudentsCnt > 4) {
      tx.prepare(`UPDATE featured_students SET is_published = 0 WHERE sort_order > 4`).run();
    }

    // 4. Add default institutional values to 'about' section meta_json if missing
    const aboutRow = tx.prepare(`SELECT meta_json FROM website_sections WHERE section_key = 'about'`).get() as
      | { meta_json: string }
      | undefined;
    if (aboutRow) {
      try {
        const meta = JSON.parse(aboutRow.meta_json || '{}');
        if (!Array.isArray(meta.values) || meta.values.length === 0) {
          meta.values = [
            { title: 'اصالت و کیفیت علمی', description: 'پایبندی دقیق به نصاب درسی به‌روز، تدریس مفهومی و تمرین‌های عملی در لابراتوار.' },
            { title: 'شفافیت و پاسخ‌گویی', description: 'ثبت منظم حاضری، نمرات امتحانات و اسناد مالی برای دسترسی مستقیم شاگردان و خانواده‌ها.' },
            { title: 'انضباط و محیط امن اکادمیک', description: 'صنف‌های با ظرفیت محدود، نظارت مستقیم اساتید و رعایت اصول اخلاق آموزشی.' },
            { title: 'پشتیبانی چندزبانه و فراگیر', description: 'ارائه آموزش و خدمات اداری هم‌سو با نیازهای محلی به پنج زبان ملی و بین‌المللی.' },
          ];
          tx.prepare(`UPDATE website_sections SET meta_json = ? WHERE section_key = 'about'`).run(JSON.stringify(meta));
        }
      } catch {
        // leave custom JSON intact
      }
    }

    // 5. Update slider #10 CTA label away from 'Portal' phrasing if still default
    tx.prepare(`UPDATE website_sliders SET button_label = 'ورود' WHERE button_url = '/login' AND button_label = 'ورود به پورتال'`).run();

    tx.prepare(`INSERT INTO system_settings (key, value) VALUES ('public_cms_v2_migrated', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`).run();
  });
}

function applyEmsV3Migration(db: DatabaseSync): void {
  const flag = db
    .prepare(`SELECT value FROM system_settings WHERE key = 'v3_afn_branding_cleanup_migrated'`)
    .get() as { value: string } | undefined;
  if (flag?.value === '1') return;

  runTransaction((tx) => {
    tx.prepare(`UPDATE system_settings SET value = 'AFN' WHERE key = 'currency_symbol' AND value IN ('$', 'USD', 'usd')`).run();
    tx.prepare(`INSERT OR IGNORE INTO website_settings (key, value) VALUES ('site_logo_url', '')`).run();
    tx.prepare(`UPDATE certificate_templates SET seal_text = ''`).run();
    tx.prepare(
      `UPDATE notifications SET message = REPLACE(message, 'دالر', 'افغانی') WHERE message LIKE '%دالر%'`
    ).run();
    tx.prepare(
      `INSERT INTO system_settings (key, value) VALUES ('v3_afn_branding_cleanup_migrated', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`
    ).run();
  });
}

