// src/routes/employees.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { audit } from '../db.js';
import { authenticate, require, can } from '../auth.js';

const router = Router();
router.use(authenticate);

const BASE_SELECT = `
  SELECT e.*, d.name AS department_name,
         m.full_name AS manager_name
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m   ON m.id = e.manager_id
`;

// List employees. HR/admin see all; managers see their department; employees see self.
router.get('/', (req, res) => {
  const { role } = req.user;
  const q = (req.query.q || '').trim();
  let rows;
  if (can(role, 'employee.read') && role !== 'manager') {
    rows = db.prepare(`${BASE_SELECT} ORDER BY e.full_name`).all();
  } else if (role === 'manager') {
    rows = db.prepare(`${BASE_SELECT} WHERE e.department_id = ? ORDER BY e.full_name`)
      .all(req.employee?.department_id ?? -1);
  } else {
    rows = req.employee ? [db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(req.employee.id)] : [];
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter(r =>
      [r.full_name, r.email, r.employee_code, r.designation]
        .some(v => (v || '').toLowerCase().includes(needle)));
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Employee not found.' });
  if (req.user.role === 'employee' && req.employee?.id !== row.id) {
    return res.status(403).json({ error: 'You can only view your own profile.' });
  }
  res.json(row);
});

// Create employee — optionally creates a login account at the same time.
// Only HR and super_admin can call this (employee.write permission).
router.post('/', require('employee.write'), (req, res) => {
  const b = req.body || {};
  if (!b.full_name) return res.status(400).json({ error: 'Full name is required.' });

  let userId = null;
  if (b.create_account) {
    if (!b.user_email || !b.user_password) {
      return res.status(400).json({ error: 'Email and password are required to create a login account.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(b.user_email);
    if (existing) return res.status(400).json({ error: 'An account with this email already exists.' });
    const hash = bcrypt.hashSync(b.user_password, 10);
    userId = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)')
      .run(b.user_email, hash, 'employee').lastInsertRowid;
    audit(req.user.id, 'user.create', `${b.user_email} (employee) for ${b.full_name}`);
  }

  const info = db.prepare(`
    INSERT INTO employees
      (user_id, employee_code, full_name, cnic, date_of_birth, gender, marital_status,
       address, phone, email, department_id, designation, manager_id, date_of_joining,
       employment_status, probation_end, date_of_termination, termination_reason, shift,
       salary, bank_name, iban, emergency_name, emergency_relation, emergency_phone)
    VALUES (@user_id,@employee_code,@full_name,@cnic,@date_of_birth,@gender,@marital_status,
       @address,@phone,@email,@department_id,@designation,@manager_id,@date_of_joining,
       @employment_status,@probation_end,@date_of_termination,@termination_reason,@shift,
       @salary,@bank_name,@iban,@emergency_name,@emergency_relation,@emergency_phone)
  `).run({
    user_id: userId,
    employee_code: b.employee_code ?? null,
    full_name: b.full_name,
    cnic: b.cnic ?? null,
    date_of_birth: b.date_of_birth ?? null,
    gender: b.gender ?? null,
    marital_status: b.marital_status ?? null,
    address: b.address ?? null,
    phone: b.phone ?? null,
    email: b.user_email || b.email || null,
    department_id: b.department_id ?? null,
    designation: b.designation ?? null,
    manager_id: b.manager_id ?? null,
    date_of_joining: b.date_of_joining ?? null,
    employment_status: b.employment_status ?? 'active',
    probation_end: b.probation_end ?? null,
    date_of_termination: b.date_of_termination ?? null,
    termination_reason: b.termination_reason ?? null,
    shift: b.shift ?? null,
    salary: b.salary ?? null,
    bank_name: b.bank_name ?? null,
    iban: b.iban ?? null,
    emergency_name: b.emergency_name ?? null,
    emergency_relation: b.emergency_relation ?? null,
    emergency_phone: b.emergency_phone ?? null,
  });
  audit(req.user.id, 'employee.create', `#${info.lastInsertRowid} ${b.full_name}`);
  res.status(201).json(db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(info.lastInsertRowid));
});

// Edit employee — HR and super_admin only.
router.put('/:id', require('employee.edit'), (req, res) => {
  const existing = db.prepare('SELECT id FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found.' });
  const b = req.body || {};
  if (!b.full_name) return res.status(400).json({ error: 'Full name is required.' });
  db.prepare(`
    UPDATE employees SET
      employee_code=@employee_code, full_name=@full_name, cnic=@cnic,
      date_of_birth=@date_of_birth, gender=@gender, marital_status=@marital_status,
      address=@address, phone=@phone, email=@email, department_id=@department_id,
      designation=@designation, manager_id=@manager_id, date_of_joining=@date_of_joining,
      employment_status=@employment_status, probation_end=@probation_end,
      date_of_termination=@date_of_termination, termination_reason=@termination_reason,
      shift=@shift, salary=@salary, bank_name=@bank_name, iban=@iban,
      emergency_name=@emergency_name, emergency_relation=@emergency_relation,
      emergency_phone=@emergency_phone
    WHERE id=@id
  `).run({
    id: Number(req.params.id),
    employee_code: b.employee_code ?? null,
    full_name: b.full_name,
    cnic: b.cnic ?? null,
    date_of_birth: b.date_of_birth ?? null,
    gender: b.gender ?? null,
    marital_status: b.marital_status ?? null,
    address: b.address ?? null,
    phone: b.phone ?? null,
    email: b.email ?? null,
    department_id: b.department_id ?? null,
    designation: b.designation ?? null,
    manager_id: b.manager_id ?? null,
    date_of_joining: b.date_of_joining ?? null,
    employment_status: b.employment_status ?? 'active',
    probation_end: b.probation_end ?? null,
    date_of_termination: b.date_of_termination ?? null,
    termination_reason: b.termination_reason ?? null,
    shift: b.shift ?? null,
    salary: b.salary ?? null,
    bank_name: b.bank_name ?? null,
    iban: b.iban ?? null,
    emergency_name: b.emergency_name ?? null,
    emergency_relation: b.emergency_relation ?? null,
    emergency_phone: b.emergency_phone ?? null,
  });
  audit(req.user.id, 'employee.update', `#${req.params.id} ${b.full_name}`);
  res.json(db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(req.params.id));
});

// Change employment status only — convenient shortcut used by the status dropdown.
router.patch('/:id/status', require('employee.edit'), (req, res) => {
  const { employment_status } = req.body || {};
  if (!employment_status) return res.status(400).json({ error: 'employment_status is required.' });
  const existing = db.prepare('SELECT id FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Employee not found.' });
  db.prepare('UPDATE employees SET employment_status=? WHERE id=?').run(employment_status, req.params.id);
  audit(req.user.id, 'employee.status', `#${req.params.id} -> ${employment_status}`);
  res.json(db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(req.params.id));
});

router.get('/meta/departments', (req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY name').all());
});

router.get('/meta/managers', (req, res) => {
  res.json(db.prepare('SELECT id, full_name, designation FROM employees ORDER BY full_name').all());
});

export default router;
