// src/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { audit } from '../db.js';
import { signToken, authenticate } from '../auth.js';

const router = Router();

// Simple in-memory failed-attempt tracker for account lock-out.
const attempts = new Map(); // email -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const rec = attempts.get(email);
  if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const valid = user && bcrypt.compareSync(password, user.password_hash);

  if (!valid) {
    const count = (rec?.count || 0) + 1;
    attempts.set(email, { count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : null });
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated.' });

  attempts.delete(email);
  audit(user.id, 'login', email);
  const employee = db.prepare('SELECT id, full_name, department_id FROM employees WHERE user_id = ?').get(user.id);
  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, role: user.role, name: employee?.full_name || user.email },
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.employee?.full_name || req.user.email,
      employee_id: req.employee?.id || null,
    },
  });
});

export default router;
