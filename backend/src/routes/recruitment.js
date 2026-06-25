// src/routes/recruitment.js
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db, { audit } from '../db.js';
import { authenticate, require } from '../auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, UPLOAD_DIR),
    filename: (_r, f, cb) => cb(null, `resume-${crypto.randomUUID()}${path.extname(f.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'hired', 'rejected'];

const router = Router();
router.use(authenticate, require('recruitment.read'));

// --- Job openings ---
router.get('/jobs', (_req, res) => {
  res.json(db.prepare(`
    SELECT j.*, d.name AS department_name,
      (SELECT COUNT(*) FROM candidates c WHERE c.job_id = j.id) AS candidate_count
    FROM job_openings j LEFT JOIN departments d ON d.id = j.department_id
    ORDER BY j.created_at DESC
  `).all());
});

router.post('/jobs', require('recruitment.write'), (req, res) => {
  const { title, department_id, description, shift, salary } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Job title is required.' });
  const info = db.prepare('INSERT INTO job_openings (title, department_id, description, shift, salary) VALUES (?,?,?,?,?)')
    .run(title, department_id || null, description || null, shift || null, salary ? Number(salary) : null);
  audit(req.user.id, 'job.create', title);
  res.status(201).json(db.prepare('SELECT * FROM job_openings WHERE id = ?').get(info.lastInsertRowid));
});

// --- Candidates ---
// Always join job title so the frontend always has it regardless of filter.
const CAND_SELECT = `
  SELECT c.*, j.title AS job_title, j.department_id AS job_department_id
  FROM candidates c
  JOIN job_openings j ON j.id = c.job_id
`;

router.get('/candidates', (req, res) => {
  const jobId = req.query.job_id;
  const rows = jobId
    ? db.prepare(`${CAND_SELECT} WHERE c.job_id = ? ORDER BY c.created_at DESC`).all(jobId)
    : db.prepare(`${CAND_SELECT} ORDER BY c.created_at DESC`).all();
  res.json(rows);
});

router.post('/candidates', require('recruitment.write'), upload.single('resume'), (req, res) => {
  const { job_id, full_name, email, phone, status } = req.body || {};
  if (!job_id || !full_name) return res.status(400).json({ error: 'Job and candidate name are required.' });
  const initialStatus = status && STATUSES.includes(status) ? status : 'applied';
  const info = db.prepare(`
    INSERT INTO candidates (job_id, full_name, email, phone, resume_stored, resume_name, status)
    VALUES (?,?,?,?,?,?,?)
  `).run(job_id, full_name, email || null, phone || null,
         req.file?.filename || null, req.file?.originalname || null, initialStatus);
  audit(req.user.id, 'candidate.create', full_name);
  res.status(201).json(db.prepare(`${CAND_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid));
});

router.patch('/candidates/:id', require('recruitment.write'), (req, res) => {
  const cand = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!cand) return res.status(404).json({ error: 'Candidate not found.' });
  const { status, interview_at, feedback } = req.body || {};
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE candidates SET status=?, interview_at=?, feedback=? WHERE id=?').run(
    status || cand.status,
    interview_at ?? cand.interview_at,
    feedback ?? cand.feedback,
    cand.id,
  );
  audit(req.user.id, 'candidate.update', `#${cand.id} -> ${status || cand.status}`);
  res.json(db.prepare(`${CAND_SELECT} WHERE c.id = ?`).get(cand.id));
});

router.get('/candidates/:id/resume', (req, res) => {
  const c = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!c?.resume_stored) return res.status(404).json({ error: 'No resume on file.' });
  res.download(path.join(UPLOAD_DIR, c.resume_stored), c.resume_name);
});

export default router;
