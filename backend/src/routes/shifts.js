// src/routes/shifts.js
import { Router } from 'express';
import db, { audit } from '../db.js';
import { authenticate, can } from '../auth.js';

const router = Router();
router.use(authenticate);

const canManage = (req, res, next) => {
  if (can(req.user.role, 'shift.write')) return next();
  return res.status(403).json({ error: 'HR or Administrator access required.' });
};

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM shifts ORDER BY name').all());
});

router.post('/', canManage, (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Shift name is required.' });
  try {
    const info = db.prepare('INSERT INTO shifts (name) VALUES (?)').run(name.trim());
    audit(req.user.id, 'shift.create', name.trim());
    res.status(201).json(db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'A shift with this name already exists.' });
    throw e;
  }
});

router.delete('/:id', canManage, (req, res) => {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  db.prepare('DELETE FROM shifts WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'shift.delete', shift.name);
  res.json({ ok: true });
});

export default router;
