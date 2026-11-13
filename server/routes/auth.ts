import { Router } from 'express';
import { getDb, hashPassword, logAudit, verifyPassword } from '../db/database';
import {
  type AuthedRequest,
  createSession,
  destroySession,
  getClientIp,
  requireAuth,
  SESSION_COOKIE_NAME,
} from '../middleware/auth';

const router = Router();

function isHttpsRequest(req: AuthedRequest): boolean {
  const fwdProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  return req.secure || fwdProto.includes('https') || origin.startsWith('https://') || referer.startsWith('https://');
}

function getCookieOptions(req: AuthedRequest) {
  const isHttps = isHttpsRequest(req);
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    ...(isHttps ? { partitioned: true } : {}),
  };
}

function getSystemBranding() {
  const db = getDb();
  const siteNameRow = db.prepare(`SELECT value FROM website_settings WHERE key = 'site_name'`).get() as { value: string } | undefined;
  const siteLogoRow = db.prepare(`SELECT value FROM website_settings WHERE key = 'site_logo_url'`).get() as { value: string } | undefined;
  const currencyRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'currency_symbol'`).get() as { value: string } | undefined;
  return {
    site_name: siteNameRow?.value || 'Danesh Academy',
    site_logo_url: siteLogoRow?.value || '',
    currency_symbol: currencyRow?.value && currencyRow.value !== '$' && currencyRow.value !== 'USD' ? currencyRow.value : 'AFN',
  };
}

router.get('/me', (req: AuthedRequest, res) => {
  const db = getDb();
  const defaultLangRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'default_language'`).get() as { value: string } | undefined;
  const branding = getSystemBranding();
  if (!req.authUser) {
    res.json({ authenticated: false, user: null, csrfToken: null, sessionToken: null, defaultLanguage: defaultLangRow?.value || 'fa', branding });
    return;
  }
  res.json({
    authenticated: true,
    user: req.authUser,
    csrfToken: req.csrfToken,
    sessionToken: req.sessionToken || null,
    defaultLanguage: defaultLangRow?.value || 'fa',
    branding,
  });
});

router.post('/login', (req: AuthedRequest, res) => {
  const db = getDb();
  const identifier = String(req.body?.identifier || '').trim();
  const password = String(req.body?.password || '');
  const ip = getClientIp(req);

  if (!identifier || !password) {
    res.status(400).json({ error: 'Username/email and password are required.' });
    return;
  }

  // Throttle check: max 5 failed attempts within last 15 minutes
  const recentFails = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM login_attempts
       WHERE identifier = ? AND success = 0 AND datetime(attempted_at) >= datetime('now', '-15 minutes')`
    )
    .get(identifier) as { cnt: number };

  if (recentFails.cnt >= 5) {
    logAudit({
      userName: identifier,
      action: 'LOGIN_THROTTLED',
      module: 'auth',
      recordRef: identifier,
      result: 'denied',
      ipAddress: ip,
    });
    res.status(429).json({ error: 'Too many failed login attempts. Please wait 15 minutes or contact an administrator.' });
    return;
  }

  const user = db
    .prepare(`SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1`)
    .get(identifier, identifier) as
    | {
        id: number;
        username: string;
        email: string;
        password_hash: string;
        role: 'admin' | 'teacher' | 'student';
        full_name: string;
        phone: string;
        photo_url: string;
        preferred_lang: 'en' | 'fa' | 'ps' | 'uz' | 'tk';
        status: 'active' | 'inactive';
        locked_until: string | null;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    db.prepare(`INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, 0)`).run(identifier, ip);
    if (user) {
      db.prepare(`UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?`).run(user.id);
    }
    logAudit({
      userId: user?.id ?? null,
      userName: identifier,
      userRole: user?.role ?? 'unknown',
      action: 'LOGIN_FAILED',
      module: 'auth',
      recordRef: identifier,
      result: 'failure',
      ipAddress: ip,
    });
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  if (user.status !== 'active') {
    logAudit({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      action: 'LOGIN_INACTIVE_ACCOUNT',
      module: 'auth',
      recordRef: user.username,
      result: 'denied',
      ipAddress: ip,
    });
    res.status(403).json({ error: 'Account is deactivated. Contact the administrator.' });
    return;
  }

  // Clear previous session if any, regenerate session on login
  if (req.sessionToken) {
    destroySession(req.sessionToken);
  }
  db.prepare(`INSERT INTO login_attempts (identifier, ip_address, success) VALUES (?, ?, 1)`).run(identifier, ip);
  db.prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`).run(user.id);

  const { token, csrfToken } = createSession(user.id, req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...(getCookieOptions(req) as any),
    maxAge: 24 * 60 * 60 * 1000,
  });

  logAudit({
    userId: user.id,
    userName: user.username,
    userRole: user.role,
    action: 'LOGIN_SUCCESS',
    module: 'auth',
    recordRef: user.username,
    result: 'success',
    ipAddress: ip,
  });

  let teacherId: number | null = null;
  let studentId: number | null = null;
  if (user.role === 'teacher') {
    const t = db.prepare(`SELECT id FROM teachers WHERE user_id = ?`).get(user.id) as { id: number } | undefined;
    teacherId = t?.id ?? null;
  } else if (user.role === 'student') {
    const s = db.prepare(`SELECT id FROM students WHERE user_id = ?`).get(user.id) as { id: number } | undefined;
    studentId = s?.id ?? null;
  }

  res.json({
    csrfToken,
    sessionToken: token,
    branding: getSystemBranding(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      photo_url: user.photo_url,
      preferred_lang: user.preferred_lang,
      status: user.status,
      teacher_id: teacherId,
      student_id: studentId,
    },
  });
});

router.post('/logout', (req: AuthedRequest, res) => {
  if (req.sessionToken) {
    destroySession(req.sessionToken);
  }
  if (req.authUser) {
    logAudit({
      userId: req.authUser.id,
      userName: req.authUser.username,
      userRole: req.authUser.role,
      action: 'LOGOUT',
      module: 'auth',
      recordRef: req.authUser.username,
      result: 'success',
      ipAddress: getClientIp(req),
    });
  }
  res.clearCookie(SESSION_COOKIE_NAME, getCookieOptions(req) as any);
  res.json({ ok: true });
});

router.post('/language', (req: AuthedRequest, res) => {
  const lang = String(req.body?.lang || '');
  if (!['en', 'fa', 'ps', 'uz', 'tk'].includes(lang)) {
    res.status(400).json({ error: 'Unsupported language code' });
    return;
  }
  if (req.authUser) {
    const db = getDb();
    db.prepare(`UPDATE users SET preferred_lang = ?, updated_at = datetime('now') WHERE id = ?`).run(lang, req.authUser.id);
  }
  res.json({ ok: true, lang });
});

router.post('/password-reset-request', (req: AuthedRequest, res) => {
  const identifier = String(req.body?.identifier || '').trim();
  const reason = String(req.body?.reason || '').trim();
  if (!identifier) {
    res.status(400).json({ error: 'Username or email is required.' });
    return;
  }
  const db = getDb();
  db.prepare(`INSERT INTO password_reset_requests (identifier, reason) VALUES (?, ?)`).run(identifier, reason);
  logAudit({
    userName: identifier,
    action: 'PASSWORD_RESET_REQUESTED',
    module: 'auth',
    recordRef: identifier,
    result: 'success',
    ipAddress: getClientIp(req),
  });
  res.json({ ok: true, message: 'Password reset request submitted to the administrator.' });
});

router.post('/change-password', requireAuth, (req: AuthedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters.' });
    return;
  }
  const db = getDb();
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.authUser!.id) as { password_hash: string };
  if (!verifyPassword(currentPassword, row.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
    hashPassword(newPassword),
    req.authUser!.id
  );
  logAudit({
    userId: req.authUser!.id,
    userName: req.authUser!.username,
    userRole: req.authUser!.role,
    action: 'PASSWORD_CHANGED',
    module: 'auth',
    recordRef: req.authUser!.username,
    result: 'success',
    ipAddress: getClientIp(req),
  });
  res.json({ ok: true });
});

router.put('/profile', requireAuth, (req: AuthedRequest, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const hasPhotoProp = Object.prototype.hasOwnProperty.call(req.body || {}, 'photo_url');
  const nextPhotoUrl = hasPhotoProp ? String(req.body?.photo_url ?? '').trim() : undefined;

  if (!fullName) {
    res.status(400).json({ error: 'Full name is required.' });
    return;
  }
  if (nextPhotoUrl && !/^(\/api\/public\/media\/|\/src\/assets\/|https?:\/\/)/.test(nextPhotoUrl)) {
    res.status(400).json({ error: 'Invalid profile photograph URL.' });
    return;
  }

  const db = getDb();
  if (hasPhotoProp) {
    db.prepare(`UPDATE users SET full_name = ?, phone = ?, photo_url = ?, updated_at = datetime('now') WHERE id = ?`).run(
      fullName,
      phone,
      nextPhotoUrl ?? '',
      req.authUser!.id
    );
  } else {
    db.prepare(`UPDATE users SET full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`).run(
      fullName,
      phone,
      req.authUser!.id
    );
  }

  if (req.authUser!.role === 'teacher' && req.authUser!.teacher_id) {
    if (hasPhotoProp) {
      db.prepare(`UPDATE teachers SET phone = ?, photo_url = ? WHERE id = ?`).run(phone, nextPhotoUrl ?? '', req.authUser!.teacher_id);
    } else {
      db.prepare(`UPDATE teachers SET phone = ? WHERE id = ?`).run(phone, req.authUser!.teacher_id);
    }
  }
  if (req.authUser!.role === 'student' && req.authUser!.student_id) {
    if (hasPhotoProp) {
      db.prepare(`UPDATE students SET phone = ?, photo_url = ? WHERE id = ?`).run(phone, nextPhotoUrl ?? '', req.authUser!.student_id);
    } else {
      db.prepare(`UPDATE students SET phone = ? WHERE id = ?`).run(phone, req.authUser!.student_id);
    }
  }

  logAudit({
    userId: req.authUser!.id,
    userName: req.authUser!.username,
    userRole: req.authUser!.role,
    action: 'PROFILE_UPDATED',
    module: 'auth',
    recordRef: req.authUser!.username,
    result: 'success',
    ipAddress: getClientIp(req),
  });
  res.json({ ok: true, photo_url: nextPhotoUrl });
});

export default router;
