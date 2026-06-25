// src/routes/admin.js
// Super-admin-only: department and user management.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { audit } from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();
router.use(authenticate);

const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super administrator access required.' });
  }
  next();
};
router.use(superAdminOnly);

// --- Departments ---
router.get('/departments', (_req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all());
});

router.post('/departments', (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Department name is required.' });
  try {
    const info = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name.trim());
    audit(req.user.id, 'department.create', name.trim());
    res.status(201).json(db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'A department with this name already exists.' });
    throw e;
  }
});

router.delete('/departments/:id', (req, res) => {
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) return res.status(404).json({ error: 'Department not found.' });
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'department.delete', dept.name);
  res.json({ ok: true });
});

// --- Users ---
router.get('/users', (_req, res) => {
  const users = db.prepare('SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  const empMap = {};
  db.prepare('SELECT user_id, full_name FROM employees WHERE user_id IS NOT NULL').all()
    .forEach(e => { empMap[e.user_id] = e.full_name; });
  res.json(users.map(u => ({ ...u, full_name: empMap[u.id] || null })));
});

router.post('/users', (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required.' });
  }
  if (!['super_admin', 'hr', 'manager', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)').run(email, hash, role);
  audit(req.user.id, 'user.create', `${email} (${role})`);
  res.status(201).json(db.prepare('SELECT id, email, role, is_active, created_at FROM users WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { is_active, role, password } = req.body || {};
  if (role && !['super_admin', 'hr', 'manager', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if (password) {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), user.id);
  }
  db.prepare('UPDATE users SET is_active=COALESCE(?,is_active), role=COALESCE(?,role) WHERE id=?')
    .run(is_active ?? null, role ?? null, user.id);
  audit(req.user.id, 'user.update', `#${user.id} ${user.email}`);
  res.json(db.prepare('SELECT id, email, role, is_active, created_at FROM users WHERE id = ?').get(user.id));
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'user.delete', user.email);
  res.json({ ok: true });
});

export default router;
