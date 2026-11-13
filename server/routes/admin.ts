import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  BACKUPS_DIR,
  createNotification,
  DB_PATH,
  getDb,
  hashPassword,
  logAudit,
  PUBLIC_MEDIA_DIR,
  resetDbConnection,
  UPLOADS_DIR,
} from '../db/database';
import { type AuthedRequest, getClientIp, requireAuth, requireRole } from '../middleware/auth';
import { formatCurrency, isAllowedImageUpload, sanitizeSlug } from '../../src/utils/eduLogic';

const router = Router();

// Safe upload configuration
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.mp4', '.webm']);
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'application/pdf', 'application/msword', 'application/vnd.', 'text/plain'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p));
    if (!ALLOWED_EXTS.has(ext) || !mimeOk) {
      cb(new Error('Unsupported or unsafe file type.'));
      return;
    }
    cb(null, true);
  },
});

const publicImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PUBLIC_MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `img-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const uploadImage = multer({
  storage: publicImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for images
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImageUpload(file.originalname, file.mimetype)) {
      cb(new Error('Only JPG, PNG, WEBP, or GIF image files up to 5MB are allowed.'));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

// ─── SECURE FILE UPLOAD & AUTHORIZED DOWNLOAD ────────────────────────────────
router.post('/upload', (req: AuthedRequest, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: err.message || 'File upload failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }
    res.status(201).json({
      ok: true,
      url: `/api/admin/files/${req.file.filename}`,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
    });
  });
});

router.post('/upload-image', (req: AuthedRequest, res) => {
  uploadImage.single('file')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Image upload failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    res.status(201).json({
      ok: true,
      url: `/api/public/media/${req.file.filename}`,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
    });
  });
});

router.get('/files/:filename', (req: AuthedRequest, res) => {
  const safeFile = path.basename(req.params.filename);
  const fullPath = path.join(UPLOADS_DIR, safeFile);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(fullPath);
});

// ─── WEBSITE CMS MANAGEMENT (ADMIN ONLY) ─────────────────────────────────────
router.get('/cms/all', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const settingsRows = db.prepare(`SELECT key, value FROM website_settings`).all() as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  res.json({
    settings,
    sliders: db.prepare(`SELECT * FROM website_sliders ORDER BY sort_order ASC, id ASC`).all(),
    sections: db.prepare(`SELECT * FROM website_sections ORDER BY sort_order ASC, id ASC`).all(),
    pages: db.prepare(`SELECT * FROM website_pages ORDER BY id DESC`).all(),
    menus: db.prepare(`SELECT * FROM website_menus ORDER BY sort_order ASC, id ASC`).all(),
    galleryCategories: db.prepare(`SELECT * FROM gallery_categories ORDER BY id ASC`).all(),
    galleryMedia: db.prepare(`SELECT gm.*, gc.name AS category_name FROM gallery_media gm JOIN gallery_categories gc ON gc.id = gm.category_id ORDER BY gm.id DESC`).all(),
    featuredStudents: db.prepare(`SELECT fs.*, s.student_code, s.first_name || ' ' || s.last_name AS student_name FROM featured_students fs JOIN students s ON s.id = fs.student_id ORDER BY fs.sort_order ASC`).all(),
    courses: db.prepare(`SELECT id, course_code, title, status, featured, duration_weeks, fee_amount, image_url FROM courses ORDER BY id ASC`).all(),
    teachers: db.prepare(`SELECT id, teacher_code, first_name, last_name, specialization, status, show_on_website, featured_on_home, photo_url FROM teachers ORDER BY id ASC`).all(),
  });
});

router.put('/cms/settings', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const entries = req.body || {};
  const upsert = db.prepare(`INSERT INTO website_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  for (const [k, v] of Object.entries(entries)) {
    upsert.run(String(k), String(v ?? ''));
  }
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'WEBSITE_SETTINGS_UPDATED', module: 'website', ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.put('/cms/logo', requireRole('admin'), (req: AuthedRequest, res) => {
  const logoUrl = String(req.body?.site_logo_url ?? '').trim();
  if (logoUrl && !/^(\/api\/public\/media\/|\/src\/assets\/|https?:\/\/)/.test(logoUrl)) {
    res.status(400).json({ error: 'Invalid logo image URL.' });
    return;
  }
  const db = getDb();
  db.prepare(`INSERT INTO website_settings (key, value) VALUES ('site_logo_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(logoUrl);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: logoUrl ? 'SYSTEM_LOGO_UPDATED' : 'SYSTEM_LOGO_REMOVED', module: 'website', recordRef: logoUrl || 'cleared', ipAddress: getClientIp(req) });
  res.json({ ok: true, site_logo_url: logoUrl });
});

router.delete('/cms/logo', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(`INSERT INTO website_settings (key, value) VALUES ('site_logo_url', '') ON CONFLICT(key) DO UPDATE SET value = ''`).run();
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SYSTEM_LOGO_REMOVED', module: 'website', recordRef: 'cleared', ipAddress: getClientIp(req) });
  res.json({ ok: true, site_logo_url: '' });
});

router.post('/cms/sliders', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || !b.image_url) {
    res.status(400).json({ error: 'Slide title and image URL are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO website_sliders (title, subtitle, button_label, button_url, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(String(b.title), String(b.subtitle || ''), String(b.button_label || ''), String(b.button_url || '#courses'), String(b.image_url), Number(b.sort_order || 1), b.is_active === false ? 0 : 1);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SLIDER_CREATED', module: 'website', recordRef: String(info.lastInsertRowid), ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/cms/sliders/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const db = getDb();
  db.prepare(`UPDATE website_sliders SET title=?, subtitle=?, button_label=?, button_url=?, image_url=?, sort_order=?, is_active=? WHERE id=?`).run(
    String(b.title || ''),
    String(b.subtitle || ''),
    String(b.button_label || ''),
    String(b.button_url || ''),
    String(b.image_url || ''),
    Number(b.sort_order || 1),
    b.is_active ? 1 : 0,
    Number(req.params.id)
  );
  res.json({ ok: true });
});

router.delete('/cms/sliders/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  getDb().prepare(`DELETE FROM website_sliders WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

router.put('/cms/sections/:key', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  getDb()
    .prepare(`UPDATE website_sections SET title=?, subtitle=?, content_html=?, is_visible=?, meta_json=? WHERE section_key=?`)
    .run(
      String(b.title || ''),
      String(b.subtitle || ''),
      String(b.content_html || ''),
      b.is_visible === false ? 0 : 1,
      typeof b.meta_json === 'string' ? b.meta_json : JSON.stringify(b.meta_json || {}),
      req.params.key
    );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SECTION_UPDATED', module: 'website', recordRef: req.params.key, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.post('/cms/pages', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const slug = sanitizeSlug(String(b.slug || title));
  if (!title || !slug || ['admin', 'teacher', 'student', 'login', 'api'].includes(slug)) {
    res.status(400).json({ error: 'Valid non-reserved page title and slug are required.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(`INSERT INTO website_pages (slug, title, content_html, is_published, is_system) VALUES (?, ?, ?, ?, 0)`)
    .run(slug, title, String(b.content_html || ''), b.is_published === false ? 0 : 1);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'PAGE_CREATED', module: 'website', recordRef: slug, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid), slug });
});

router.put('/cms/pages/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  getDb()
    .prepare(`UPDATE website_pages SET title=?, content_html=?, is_published=?, updated_at=datetime('now') WHERE id=?`)
    .run(String(b.title || ''), String(b.content_html || ''), b.is_published ? 1 : 0, Number(req.params.id));
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'PAGE_UPDATED', module: 'website', recordRef: req.params.id, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.delete('/cms/pages/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT is_system FROM website_pages WHERE id = ?`).get(Number(req.params.id)) as { is_system: number } | undefined;
  if (row?.is_system) {
    res.status(400).json({ error: 'System pages cannot be deleted; you may unpublish them instead.' });
    return;
  }
  db.prepare(`DELETE FROM website_pages WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/cms/menus', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.label || !b.url) {
    res.status(400).json({ error: 'Menu label and URL are required.' });
    return;
  }
  const info = getDb()
    .prepare(`INSERT INTO website_menus (label, url, target_page_slug, sort_order, is_visible, is_essential) VALUES (?, ?, ?, ?, 1, 0)`)
    .run(String(b.label).trim(), String(b.url).trim(), String(b.target_page_slug || ''), Number(b.sort_order || 10));
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/cms/menus/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM website_menus WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Menu link not found.' });
    return;
  }
  const label = String(b.label ?? existing.label).trim();
  const url = existing.is_essential ? existing.url : String(b.url ?? existing.url).trim();
  const targetSlug = existing.is_essential ? existing.target_page_slug : String(b.target_page_slug ?? existing.target_page_slug);
  const sortOrder = Number(b.sort_order ?? existing.sort_order);
  const isVisible = b.is_visible === undefined ? existing.is_visible : b.is_visible ? 1 : 0;
  if (!label || !url) {
    res.status(400).json({ error: 'Menu label and URL are required.' });
    return;
  }
  db.prepare(`UPDATE website_menus SET label = ?, url = ?, target_page_slug = ?, sort_order = ?, is_visible = ? WHERE id = ?`).run(
    label,
    url,
    targetSlug,
    sortOrder,
    isVisible,
    id
  );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'MENU_UPDATED', module: 'website', recordRef: String(id), ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.delete('/cms/menus/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT is_essential FROM website_menus WHERE id = ?`).get(Number(req.params.id)) as { is_essential: number } | undefined;
  if (row?.is_essential) {
    res.status(400).json({ error: 'Essential navigation links cannot be deleted.' });
    return;
  }
  db.prepare(`DELETE FROM website_menus WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/cms/gallery', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title || !b.file_url || !b.category_id) {
    res.status(400).json({ error: 'Category, title, and media URL are required.' });
    return;
  }
  const info = getDb()
    .prepare(`INSERT INTO gallery_media (category_id, title, description, media_type, file_url, is_published) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(Number(b.category_id), String(b.title).trim(), String(b.description || ''), b.media_type === 'video' ? 'video' : 'image', String(b.file_url), b.is_published === false ? 0 : 1);
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

router.put('/cms/gallery/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM gallery_media WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Gallery item not found.' });
    return;
  }
  const title = String(b.title ?? existing.title).trim();
  const fileUrl = String(b.file_url ?? existing.file_url).trim();
  if (!title || !fileUrl) {
    res.status(400).json({ error: 'Title and media URL are required.' });
    return;
  }
  db.prepare(`UPDATE gallery_media SET category_id = ?, title = ?, description = ?, media_type = ?, file_url = ?, is_published = ? WHERE id = ?`).run(
    Number(b.category_id ?? existing.category_id),
    title,
    String(b.description ?? existing.description),
    (b.media_type ?? existing.media_type) === 'video' ? 'video' : 'image',
    fileUrl,
    b.is_published === undefined ? existing.is_published : b.is_published ? 1 : 0,
    id
  );
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'GALLERY_UPDATED', module: 'website', recordRef: String(id), ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.delete('/cms/gallery/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  getDb().prepare(`DELETE FROM gallery_media WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/cms/featured-students', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const studentId = Number(b.student_id || 0);
  if (!studentId || !b.achievement_title) {
    res.status(400).json({ error: 'Student and achievement title are required.' });
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO featured_students (student_id, achievement_title, achievement_detail, display_photo_url, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id) DO UPDATE SET achievement_title=excluded.achievement_title, achievement_detail=excluded.achievement_detail, display_photo_url=excluded.display_photo_url, is_published=excluded.is_published`
    )
    .run(studentId, String(b.achievement_title).trim(), String(b.achievement_detail || ''), String(b.display_photo_url || ''), b.is_published === false ? 0 : 1, Number(b.sort_order || 1));
  res.status(201).json({ ok: true });
});

router.put('/cms/featured-students/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM featured_students WHERE id = ?`).get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Featured student entry not found.' });
    return;
  }
  db.prepare(`UPDATE featured_students SET achievement_title = ?, achievement_detail = ?, display_photo_url = ?, is_published = ?, sort_order = ? WHERE id = ?`).run(
    String(b.achievement_title ?? existing.achievement_title).trim(),
    String(b.achievement_detail ?? existing.achievement_detail),
    String(b.display_photo_url ?? existing.display_photo_url),
    b.is_published === undefined ? existing.is_published : b.is_published ? 1 : 0,
    Number(b.sort_order ?? existing.sort_order),
    id
  );
  res.json({ ok: true });
});

router.put('/cms/featured-students/:id/toggle', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const isPublished = req.body?.is_published ? 1 : 0;
  getDb().prepare(`UPDATE featured_students SET is_published = ? WHERE id = ?`).run(isPublished, id);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'FEATURED_STUDENT_TOGGLED', module: 'website', recordRef: `fs:${id}->${isPublished}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.put('/cms/featured-courses/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const featured = req.body?.featured ? 1 : 0;
  getDb().prepare(`UPDATE courses SET featured = ? WHERE id = ?`).run(featured, id);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'COURSE_FEATURED_TOGGLED', module: 'website', recordRef: `course:${id}->${featured}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.put('/cms/featured-teachers/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const row = db.prepare(`SELECT featured_on_home, show_on_website FROM teachers WHERE id = ?`).get(id) as
    | { featured_on_home: number; show_on_website: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Teacher not found' });
    return;
  }
  const featuredOnHome = b.featured_on_home === undefined ? row.featured_on_home : b.featured_on_home ? 1 : 0;
  const showOnWebsite = b.show_on_website === undefined ? row.show_on_website : b.show_on_website ? 1 : 0;
  db.prepare(`UPDATE teachers SET featured_on_home = ?, show_on_website = ? WHERE id = ?`).run(featuredOnHome, showOnWebsite, id);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'TEACHER_FEATURED_TOGGLED', module: 'website', recordRef: `teacher:${id}->home:${featuredOnHome},pub:${showOnWebsite}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.delete('/cms/featured-students/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  getDb().prepare(`DELETE FROM featured_students WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

// ─── USER ACCOUNTS, PASSWORD RESETS & SYSTEM SETTINGS ────────────────────────
router.get('/users', requireRole('admin'), (_req, res) => {
  const db = getDb();
  const users = db
    .prepare(`SELECT id, username, email, role, full_name, phone, preferred_lang, status, failed_login_attempts, last_login_at, created_at FROM users ORDER BY id ASC`)
    .all();
  const resetRequests = db.prepare(`SELECT * FROM password_reset_requests ORDER BY id DESC LIMIT 50`).all();
  const systemSettingsRows = db.prepare(`SELECT key, value FROM system_settings`).all() as Array<{ key: string; value: string }>;
  const systemSettings: Record<string, string> = {};
  for (const r of systemSettingsRows) systemSettings[r.key] = r.value;
  res.json({ users, resetRequests, systemSettings });
});

router.post('/users/:id/status', requireRole('admin'), (req: AuthedRequest, res) => {
  const targetId = Number(req.params.id);
  const status = req.body?.status === 'inactive' ? 'inactive' : 'active';
  if (targetId === req.authUser!.id && status === 'inactive') {
    res.status(400).json({ error: 'You cannot deactivate your own administrator account.' });
    return;
  }
  getDb().prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, targetId);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'USER_STATUS_CHANGED', module: 'users', recordRef: `uid:${targetId}->${status}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.post('/users/:id/reset-password', requireRole('admin'), (req: AuthedRequest, res) => {
  const targetId = Number(req.params.id);
  const newPassword = String(req.body?.new_password || '');
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }
  const db = getDb();
  db.prepare(`UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`).run(
    hashPassword(newPassword),
    targetId
  );
  if (req.body?.request_id) {
    db.prepare(`UPDATE password_reset_requests SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`).run(
      req.authUser!.id,
      Number(req.body.request_id)
    );
  }
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'ADMIN_PASSWORD_RESET', module: 'users', recordRef: `uid:${targetId}`, ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

router.put('/system-settings', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const upsert = db.prepare(`INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  for (const [k, v] of Object.entries(req.body || {})) {
    const val = k === 'currency_symbol' ? 'AFN' : String(v ?? '');
    upsert.run(String(k), val);
  }
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'SYSTEM_SETTINGS_UPDATED', module: 'settings', ipAddress: getClientIp(req) });
  res.json({ ok: true });
});

// ─── AUDIT LOGS (IMMUTABLE READ-ONLY) ────────────────────────────────────────
router.get('/audit-logs', requireRole('admin'), (_req, res) => {
  const logs = getDb().prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300`).all();
  res.json({ logs });
});

// ─── AUTOMATED REMINDERS ENGINE & SCHEDULER ──────────────────────────────────
export function executeRemindersEngine(triggerUserId?: number | null): { sent: number } {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;

  const jobs = db.prepare(`SELECT * FROM reminder_jobs WHERE is_enabled = 1`).all() as Array<{
    id: number;
    job_type: string;
    days_before: number;
  }>;

  const markSent = db.prepare(
    `INSERT OR IGNORE INTO reminder_sent_log (job_type, target_entity_type, target_entity_id, user_id, sent_on_date) VALUES (?, ?, ?, ?, ?)`
  );

  for (const job of jobs) {
    let jobCount = 0;
    if (job.job_type === 'homework_due') {
      const dueList = db
        .prepare(
          `SELECT h.id AS hw_id, h.title, h.due_date, s.user_id
           FROM homework h
           JOIN enrollments e ON e.class_id = h.class_id AND e.status = 'active'
           JOIN students s ON s.id = e.student_id
           LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = s.id
           WHERE hs.id IS NULL AND date(h.due_date) >= date(?) AND date(h.due_date) <= date(?, '+' || ? || ' days')`
        )
        .all(today, today, job.days_before) as Array<{ hw_id: number; title: string; due_date: string; user_id: number }>;

      for (const item of dueList) {
        const res = markSent.run('homework_due', 'homework', item.hw_id, item.user_id, today);
        if (res.changes > 0) {
          createNotification({
            title: `Homework Deadline Reminder: ${item.title}`,
            message: `Due on ${item.due_date}. Please submit before the deadline.`,
            type: 'homework',
            targetType: 'individual',
            createdBy: triggerUserId ?? null,
            recipientUserIds: [item.user_id],
          });
          jobCount++;
          sent++;
        }
      }
    } else if (job.job_type === 'fee_due') {
      const feeList = db
        .prepare(
          `SELECT sf.id AS fee_id, sf.title, sf.total_amount - sf.discount_amount - sf.paid_amount AS balance, sf.due_date, s.user_id
           FROM student_fees sf
           JOIN students s ON s.id = sf.student_id
           WHERE sf.status != 'paid' AND (sf.due_date = '' OR date(sf.due_date) <= date(?, '+' || ? || ' days'))`
        )
        .all(today, job.days_before) as Array<{ fee_id: number; title: string; balance: number; due_date: string; user_id: number }>;

      for (const item of feeList) {
        const res = markSent.run('fee_due', 'student_fee', item.fee_id, item.user_id, today);
        if (res.changes > 0) {
          createNotification({
            title: `Tuition Payment Reminder: ${item.title}`,
            message: `Outstanding balance ${formatCurrency(item.balance)}${item.due_date ? ` (Due ${item.due_date})` : ''}.`,
            type: 'finance',
            targetType: 'individual',
            createdBy: triggerUserId ?? null,
            recipientUserIds: [item.user_id],
          });
          jobCount++;
          sent++;
        }
      }
    } else if (job.job_type === 'exam_upcoming') {
      const exams = db
        .prepare(
          `SELECT ex.id AS ex_id, ex.title, ex.exam_date, s.user_id
           FROM examinations ex
           JOIN enrollments e ON e.class_id = ex.class_id AND e.status = 'active'
           JOIN students s ON s.id = e.student_id
           WHERE date(ex.exam_date) >= date(?) AND date(ex.exam_date) <= date(?, '+' || ? || ' days')`
        )
        .all(today, today, job.days_before) as Array<{ ex_id: number; title: string; exam_date: string; user_id: number }>;

      for (const item of exams) {
        const res = markSent.run('exam_upcoming', 'examination', item.ex_id, item.user_id, today);
        if (res.changes > 0) {
          createNotification({
            title: `Upcoming Examination: ${item.title}`,
            message: `Scheduled on ${item.exam_date}.`,
            type: 'exam',
            targetType: 'individual',
            createdBy: triggerUserId ?? null,
            recipientUserIds: [item.user_id],
          });
          jobCount++;
          sent++;
        }
      }
    }
    db.prepare(`UPDATE reminder_jobs SET last_run_at = datetime('now'), last_run_count = ? WHERE id = ?`).run(jobCount, job.id);
  }
  return { sent };
}

router.get('/reminders', requireRole('admin'), (_req, res) => {
  const jobs = getDb().prepare(`SELECT * FROM reminder_jobs ORDER BY id ASC`).all();
  res.json({ jobs });
});

router.put('/reminders/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  getDb()
    .prepare(`UPDATE reminder_jobs SET is_enabled = ?, days_before = ?, schedule_cron = ? WHERE id = ?`)
    .run(b.is_enabled ? 1 : 0, Number(b.days_before ?? 2), String(b.schedule_cron || '0 8 * * *'), Number(req.params.id));
  res.json({ ok: true });
});

router.post('/reminders/run', requireRole('admin'), (req: AuthedRequest, res) => {
  const result = executeRemindersEngine(req.authUser!.id);
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'REMINDERS_EXECUTED', module: 'reminders', details: result, ipAddress: getClientIp(req) });
  res.json({ ok: true, ...result });
});

// ─── DATABASE BACKUP & SAFE RESTORE (PRIVATE STORAGE) ────────────────────────
export function createDatabaseBackup(backupType: 'manual' | 'scheduled', userId: number | null, notes = ''): any {
  const db = getDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `danesh_backup_${stamp}.sqlite`;
  const destPath = path.join(BACKUPS_DIR, filename);

  // Checkpoint WAL and copy cleanly
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  fs.copyFileSync(DB_PATH, destPath);

  const fileBuf = fs.readFileSync(destPath);
  const checksum = crypto.createHash('sha256').update(fileBuf).digest('hex');

  const info = db
    .prepare(`INSERT INTO backup_records (filename, file_size, checksum_sha256, backup_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(filename, fileBuf.length, checksum, backupType, notes, userId);

  return { id: Number(info.lastInsertRowid), filename, file_size: fileBuf.length, checksum_sha256: checksum };
}

router.get('/backups', requireRole('admin'), (_req, res) => {
  const backups = getDb()
    .prepare(`SELECT b.*, u.full_name AS created_by_name FROM backup_records b LEFT JOIN users u ON u.id = b.created_by ORDER BY b.id DESC`)
    .all();
  res.json({ backups });
});

router.post('/backups', requireRole('admin'), (req: AuthedRequest, res) => {
  const created = createDatabaseBackup('manual', req.authUser!.id, String(req.body?.notes || 'Manual administrator backup'));
  logAudit({ userId: req.authUser!.id, userName: req.authUser!.username, userRole: 'admin', action: 'BACKUP_CREATED', module: 'backups', recordRef: created.filename, ipAddress: getClientIp(req) });
  res.status(201).json({ ok: true, backup: created });
});

router.get('/backups/:id/download', requireRole('admin'), (req: AuthedRequest, res) => {
  const row = getDb().prepare(`SELECT * FROM backup_records WHERE id = ?`).get(Number(req.params.id)) as { filename: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Backup record not found' });
    return;
  }
  const fullPath = path.join(BACKUPS_DIR, path.basename(row.filename));
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Backup file missing from storage' });
    return;
  }
  res.download(fullPath, row.filename);
});

router.post('/backups/:id/restore', requireRole('admin'), (req: AuthedRequest, res) => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: 'Explicit confirmation required before restoring database.' });
    return;
  }
  const db = getDb();
  const row = db.prepare(`SELECT * FROM backup_records WHERE id = ?`).get(Number(req.params.id)) as
    | { id: number; filename: string; checksum_sha256: string }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  const srcPath = path.join(BACKUPS_DIR, path.basename(row.filename));
  if (!fs.existsSync(srcPath)) {
    res.status(404).json({ error: 'Backup file missing.' });
    return;
  }

  // Verify integrity checksum before overwriting live database
  const buf = fs.readFileSync(srcPath);
  const actualChecksum = crypto.createHash('sha256').update(buf).digest('hex');
  if (actualChecksum !== row.checksum_sha256) {
    res.status(400).json({ error: 'Backup integrity check failed (SHA-256 mismatch).' });
    return;
  }

  // Create automatic safety pre-restore snapshot first
  createDatabaseBackup('scheduled', req.authUser!.id, `Pre-restore safety snapshot before ${row.filename}`);
  resetDbConnection();
  fs.copyFileSync(srcPath, DB_PATH);
  const restoredDb = getDb();
  logAudit({
    userId: req.authUser!.id,
    userName: req.authUser!.username,
    userRole: 'admin',
    action: 'DATABASE_RESTORED',
    module: 'backups',
    recordRef: row.filename,
    ipAddress: getClientIp(req),
  });
  void restoredDb;

  res.json({ ok: true, restored_from: row.filename });
});

router.delete('/backups/:id', requireRole('admin'), (req: AuthedRequest, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT filename FROM backup_records WHERE id = ?`).get(Number(req.params.id)) as { filename: string } | undefined;
  if (row) {
    const p = path.join(BACKUPS_DIR, path.basename(row.filename));
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare(`DELETE FROM backup_records WHERE id = ?`).run(Number(req.params.id));
  }
  res.json({ ok: true });
});

export default router;
