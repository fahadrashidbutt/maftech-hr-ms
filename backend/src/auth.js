// src/auth.js
// JWT issuing/verification + Role-Based Access Control middleware.
import jwt from 'jsonwebtoken';
import db from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Capability map. Each role inherits a flat list of permission codes.
// Keep this as the single source of truth for "who can do what".
const PERMISSIONS = {
  super_admin: ['*'],
  hr: [
    'employee.read', 'employee.write', 'employee.edit',
    'leave.read', 'leave.approve', 'leave.edit',
    'document.read', 'document.write',
    'recruitment.read', 'recruitment.write',
    'dashboard.hr', 'shift.write',
  ],
  manager: [
    'employee.read',
    'leave.read', 'leave.approve',
    'dashboard.hr',
  ],
  employee: [
    'employee.read.self',
    'leave.read.self', 'leave.submit',
    'document.read.self',
  ],
};

export function can(role, permission) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, SECRET, {
    expiresIn: EXPIRES_IN,
  });
}

// Attaches req.user (the auth row) and req.employee (linked profile, if any).
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, email, role, is_active FROM users WHERE id = ?').get(payload.sub);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account is inactive or not found.' });
    req.user = user;
    req.employee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(user.id) || null;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or token invalid. Please sign in again.' });
  }
}

// Route guard: require(req => boolean) or require('permission.code')
export function require(check) {
  return (req, res, next) => {
    const ok = typeof check === 'function' ? check(req) : can(req.user.role, check);
    if (!ok) return res.status(403).json({ error: 'You do not have access to this action.' });
    next();
  };
}

export { PERMISSIONS };
