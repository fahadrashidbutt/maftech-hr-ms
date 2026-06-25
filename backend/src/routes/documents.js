// src/routes/documents.js
// Per-employee document repository with upload / list / download.
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const DOC_TYPES = [
  'Appointment Letter', 'Employment Contract', 'CNIC', 'Educational Certificate',
  'Experience Letter', 'Performance Evaluation', 'Warning Letter',
  'Salary Revision Letter', 'Resignation Letter', 'Experience Certificate',
];

const router = Router();
router.use(authenticate);

router.get('/types', (_req, res) => res.json(DOC_TYPES));

// List documents for an employee. Employees may only see their own.
router.get('/employee/:employeeId', (req, res) => {
  const empId = Number(req.params.employeeId);
  if (req.user.role === 'employee' && req.employee?.id !== empId) {
    return res.status(403).json({ error: 'You can only view your own documents.' });
  }
  const rows = db.prepare(
    'SELECT id, doc_type, file_name, mime_type, size_bytes, expires_on, created_at FROM documents WHERE employee_id = ? ORDER BY created_at DESC'
  ).all(empId);
  res.json(rows);
});

router.post('/', require('document.write'), upload.single('file'), (req, res) => {
  const { employee_id, doc_type, expires_on } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'A file is required.' });
  if (!employee_id || !doc_type) return res.status(400).json({ error: 'Employee and document type are required.' });
  const info = db.prepare(`
    INSERT INTO documents (employee_id, doc_type, file_name, stored_name, mime_type, size_bytes, uploaded_by, expires_on)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(employee_id, doc_type, req.file.originalname, req.file.filename,
         req.file.mimetype, req.file.size, req.user.id, expires_on || null);
  audit(req.user.id, 'document.upload', `${doc_type} for emp #${employee_id}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (req.user.role === 'employee' && req.employee?.id !== doc.employee_id) {
    return res.status(403).json({ error: 'You can only download your own documents.' });
  }
  res.download(path.join(UPLOAD_DIR, doc.stored_name), doc.file_name);
});

export default router;
