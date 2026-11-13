import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getDb, PUBLIC_MEDIA_DIR } from '../db/database';
import { ALLOWED_IMAGE_EXTENSIONS } from '../../src/utils/eduLogic';

const router = Router();

router.get('/media/:filename', (req, res) => {
  const safeFile = path.basename(String(req.params.filename || ''));
  const ext = path.extname(safeFile).toLowerCase();
  if (!safeFile || !ALLOWED_IMAGE_EXTENSIONS.includes(ext as any)) {
    res.status(400).json({ error: 'Invalid media file type.' });
    return;
  }
  const fullPath = path.join(PUBLIC_MEDIA_DIR, safeFile);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(fullPath);
});

router.get('/bootstrap', (_req, res) => {
  const db = getDb();

  const settingsRows = db.prepare(`SELECT key, value FROM website_settings`).all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  const sliders = db
    .prepare(`SELECT * FROM website_sliders WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`)
    .all();

  const sections = db
    .prepare(`SELECT * FROM website_sections WHERE is_visible = 1 ORDER BY sort_order ASC, id ASC`)
    .all();

  const menus = db
    .prepare(
      `SELECT * FROM website_menus
       WHERE is_visible = 1
         AND COALESCE(target_page_slug, '') != 'academic-calendar'
         AND url NOT LIKE '%academic-calendar%'
       ORDER BY sort_order ASC, id ASC`
    )
    .all();

  const pages = db
    .prepare(
      `SELECT id, slug, title, content_html, updated_at
       FROM website_pages
       WHERE is_published = 1 AND slug != 'academic-calendar'
       ORDER BY id ASC`
    )
    .all();

  // Only admin-selected featured courses for homepage
  const featuredCourses = db
    .prepare(
      `SELECT c.id, c.course_code, c.title, c.description, c.duration_weeks, c.start_date, c.end_date, c.fee_amount, c.capacity, c.featured, c.image_url, c.status,
        (SELECT GROUP_CONCAT(s.name, ', ') FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.course_id = c.id) AS subject_names
       FROM courses c
       WHERE c.status IN ('active','upcoming') AND c.featured = 1
       ORDER BY c.id ASC`
    )
    .all();

  // Only admin-selected featured teachers for homepage (no sensitive data)
  const featuredTeachers = db
    .prepare(
      `SELECT t.id, t.teacher_code, t.first_name, t.last_name, t.specialization, t.qualification, t.photo_url, t.bio,
        (SELECT GROUP_CONCAT(sub_name, ', ')
         FROM (SELECT DISTINCT s.name AS sub_name
               FROM class_subject_teachers cst
               JOIN subjects s ON s.id = cst.subject_id
               WHERE cst.teacher_id = t.id)) AS subjects_taught
       FROM teachers t
       WHERE t.status = 'active' AND t.show_on_website = 1 AND t.featured_on_home = 1
       ORDER BY t.id ASC`
    )
    .all();

  // Only published top/featured students for homepage (non-confidential fields only)
  const topStudents = db
    .prepare(
      `SELECT fs.id, fs.achievement_title, fs.achievement_detail, fs.display_photo_url,
              s.first_name, s.last_name, s.photo_url AS student_photo,
              (SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS course_title,
              (SELECT cl.name FROM enrollments e JOIN classes cl ON cl.id = e.class_id WHERE e.student_id = s.id AND e.status = 'active' ORDER BY e.id DESC LIMIT 1) AS class_name
       FROM featured_students fs
       JOIN students s ON s.id = fs.student_id
       WHERE fs.is_published = 1
       ORDER BY fs.sort_order ASC, fs.id ASC`
    )
    .all();

  // Real academy statistics without certificate issuance count
  const stats = {
    active_students: (db.prepare(`SELECT COUNT(*) AS cnt FROM students WHERE status = 'active'`).get() as { cnt: number }).cnt,
    active_teachers: (db.prepare(`SELECT COUNT(*) AS cnt FROM teachers WHERE status = 'active'`).get() as { cnt: number }).cnt,
    active_courses: (db.prepare(`SELECT COUNT(*) AS cnt FROM courses WHERE status IN ('active','upcoming')`).get() as { cnt: number }).cnt,
    active_classes: (db.prepare(`SELECT COUNT(*) AS cnt FROM classes WHERE status = 'active'`).get() as { cnt: number }).cnt,
  };

  res.json({
    settings,
    currency_code: 'AFN',
    sliders,
    sections,
    menus,
    pages,
    featuredCourses,
    featuredTeachers,
    topStudents,
    stats,
  });
});

// Independent public Courses directory (ALL active/upcoming courses)
router.get('/courses', (_req, res) => {
  const db = getDb();
  const courses = db
    .prepare(
      `SELECT c.id, c.course_code, c.title, c.description, c.duration_weeks, c.start_date, c.end_date, c.fee_amount, c.capacity, c.featured, c.image_url, c.status,
        (SELECT GROUP_CONCAT(s.name, ', ') FROM course_subjects cs JOIN subjects s ON s.id = cs.subject_id WHERE cs.course_id = c.id) AS subject_names
       FROM courses c
       WHERE c.status IN ('active','upcoming')
       ORDER BY c.featured DESC, c.id ASC`
    )
    .all();
  res.json({ courses });
});

// Independent public Teachers directory (ALL active public teachers, no sensitive fields)
router.get('/teachers', (_req, res) => {
  const db = getDb();
  const teachers = db
    .prepare(
      `SELECT t.id, t.teacher_code, t.first_name, t.last_name, t.specialization, t.qualification, t.photo_url, t.bio, t.featured_on_home,
        (SELECT GROUP_CONCAT(sub_name, ', ')
         FROM (SELECT DISTINCT s.name AS sub_name
               FROM class_subject_teachers cst
               JOIN subjects s ON s.id = cst.subject_id
               WHERE cst.teacher_id = t.id)) AS subjects_taught
       FROM teachers t
       WHERE t.status = 'active' AND t.show_on_website = 1
       ORDER BY t.featured_on_home DESC, t.id ASC`
    )
    .all();
  res.json({ teachers });
});

// Independent public Gallery page (ALL published images & videos)
router.get('/gallery', (_req, res) => {
  const db = getDb();
  const galleryCategories = db.prepare(`SELECT * FROM gallery_categories ORDER BY id ASC`).all();
  const galleryMedia = db
    .prepare(
      `SELECT gm.id, gm.category_id, gm.title, gm.description, gm.media_type, gm.file_url, gm.created_at,
              gc.name AS category_name, gc.slug AS category_slug
       FROM gallery_media gm
       JOIN gallery_categories gc ON gc.id = gm.category_id
       WHERE gm.is_published = 1
       ORDER BY gm.id DESC`
    )
    .all();
  res.json({ galleryCategories, galleryMedia });
});

router.get('/page/:slug', (req, res) => {
  const db = getDb();
  if (req.params.slug === 'academic-calendar') {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  const page = db
    .prepare(`SELECT id, slug, title, content_html, updated_at FROM website_pages WHERE slug = ? AND is_published = 1`)
    .get(req.params.slug);
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.json({ page });
});

export default router;
