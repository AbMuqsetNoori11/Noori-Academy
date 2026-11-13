import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDb, logAudit } from '../db/database';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  full_name: string;
  phone: string;
  photo_url: string;
  preferred_lang: 'en' | 'fa' | 'ps' | 'uz' | 'tk';
  status: 'active' | 'inactive';
  teacher_id?: number | null;
  student_id?: number | null;
}

export interface AuthedRequest extends Request {
  authUser?: AuthUser;
  sessionToken?: string;
  csrfToken?: string;
}

export const SESSION_COOKIE_NAME = 'danesh_sid';

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

export function createSession(userId: number, req: Request): { token: string; csrfToken: string } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const timeoutRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'session_timeout_minutes'`).get() as { value: string } | undefined;
  const timeoutMins = Math.max(15, Number(timeoutRow?.value || 120));
  const expiresAt = new Date(Date.now() + timeoutMins * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (token, user_id, csrf_token, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(token, userId, csrfToken, getClientIp(req), String(req.headers['user-agent'] || '').slice(0, 200), expiresAt);

  return { token, csrfToken };
}

export function destroySession(token: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  let token = req.cookies?.[SESSION_COOKIE_NAME];
  if ((!token || typeof token !== 'string') && typeof req.headers.authorization === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization.trim());
    if (m) token = m[1].trim();
  }
  if (!token || typeof token !== 'string') {
    next();
    return;
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.token, s.csrf_token, s.expires_at, u.id, u.username, u.email, u.role, u.full_name, u.phone, u.photo_url, u.preferred_lang, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as (AuthUser & { token: string; csrf_token: string; expires_at: string }) | undefined;

  if (!row || row.status !== 'active' || new Date(row.expires_at).getTime() < Date.now()) {
    if (row) {
      db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    }
    next();
    return;
  }

  let teacherId: number | null = null;
  let studentId: number | null = null;
  if (row.role === 'teacher') {
    const t = db.prepare(`SELECT id FROM teachers WHERE user_id = ?`).get(row.id) as { id: number } | undefined;
    teacherId = t?.id ?? null;
  } else if (row.role === 'student') {
    const st = db.prepare(`SELECT id FROM students WHERE user_id = ?`).get(row.id) as { id: number } | undefined;
    studentId = st?.id ?? null;
  }

  // Sliding expiration refresh
  const timeoutRow = db.prepare(`SELECT value FROM system_settings WHERE key = 'session_timeout_minutes'`).get() as { value: string } | undefined;
  const timeoutMins = Math.max(15, Number(timeoutRow?.value || 120));
  const nextExpiry = new Date(Date.now() + timeoutMins * 60 * 1000).toISOString();
  db.prepare(`UPDATE sessions SET last_activity_at = datetime('now'), expires_at = ? WHERE token = ?`).run(nextExpiry, token);

  req.authUser = {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    full_name: row.full_name,
    phone: row.phone,
    photo_url: row.photo_url,
    preferred_lang: row.preferred_lang,
    status: row.status,
    teacher_id: teacherId,
    student_id: studentId,
  };
  req.sessionToken = row.token;
  req.csrfToken = row.csrf_token;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const headerToken = req.headers['x-csrf-token'];
    if (!headerToken || headerToken !== req.csrfToken) {
      logAudit({
        userId: req.authUser.id,
        userName: req.authUser.username,
        userRole: req.authUser.role,
        action: 'CSRF_MISMATCH',
        module: 'security',
        recordRef: req.path,
        result: 'denied',
        ipAddress: getClientIp(req),
      });
      res.status(403).json({ error: 'Invalid or missing CSRF token' });
      return;
    }
  }
  next();
}

export function requireRole(...roles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      logAudit({
        userId: req.authUser.id,
        userName: req.authUser.username,
        userRole: req.authUser.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        module: 'security',
        recordRef: `${req.method} ${req.originalUrl}`,
        result: 'denied',
        ipAddress: getClientIp(req),
      });
      res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
      return;
    }
    next();
  };
}

export function getTeacherAssignedClassIds(teacherId: number): number[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT DISTINCT class_id FROM class_subject_teachers WHERE teacher_id = ?`)
    .all(teacherId) as Array<{ class_id: number }>;
  return rows.map((r) => r.class_id);
}

export function getTeacherAssignedStudentIds(teacherId: number): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT e.student_id
       FROM enrollments e
       JOIN class_subject_teachers cst ON cst.class_id = e.class_id
       WHERE cst.teacher_id = ? AND e.status = 'active'`
    )
    .all(teacherId) as Array<{ student_id: number }>;
  return rows.map((r) => r.student_id);
}

export function isTeacherAssignedToClassSubject(teacherId: number, classId: number, subjectId?: number): boolean {
  const db = getDb();
  if (subjectId !== undefined) {
    const row = db
      .prepare(`SELECT 1 FROM class_subject_teachers WHERE teacher_id = ? AND class_id = ? AND subject_id = ?`)
      .get(teacherId, classId, subjectId);
    return Boolean(row);
  }
  const row = db
    .prepare(`SELECT 1 FROM class_subject_teachers WHERE teacher_id = ? AND class_id = ?`)
    .get(teacherId, classId);
  return Boolean(row);
}
