// src/routes/leave.js
import { Router } from 'express';
import db, { audit, notify } from '../db.js';
import { authenticate, require } from '../auth.js';

const router = Router();
router.use(authenticate);

const SELECT = `
  SELECT l.*, e.full_name AS employee_name, e.department_id
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
`;

router.get('/', (req, res) => {
  const { role } = req.user;
  let rows;
  if (role === 'super_admin' || role === 'hr') {
    rows = db.prepare(`${SELECT} ORDER BY l.created_at DESC`).all();
  } else if (role === 'manager') {
    rows = db.prepare(`${SELECT} WHERE e.department_id = ? ORDER BY l.created_at DESC`)
      .all(req.employee?.department_id ?? -1);
  } else {
    rows = db.prepare(`${SELECT} WHERE l.employee_id = ? ORDER BY l.created_at DESC`)
      .all(req.employee?.id ?? -1);
  }
  res.json(rows);
});

router.post('/', require('leave.submit'), (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body || {};
  if (!req.employee) return res.status(400).json({ error: 'No employee profile linked to this account.' });
  if (!leave_type || !start_date || !end_date) {
    return res.status(400).json({ error: 'Leave type, start date and end date are required.' });
  }
  const paid_status = req.body.paid_status === 'unpaid' ? 'unpaid' : 'paid';
  const info = db.prepare(`
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, paid_status)
    VALUES (?,?,?,?,?,?)
  `).run(req.employee.id, leave_type, start_date, end_date, reason ?? null, paid_status);

  const manager = req.employee.manager_id
    ? db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.employee.manager_id)
    : null;
  const title = `Leave request from ${req.employee.full_name}`;
  const body = `${leave_type} leave, ${start_date} to ${end_date}.`;
  if (manager?.user_id) {
    notify(manager.user_id, 'leave.submitted', title, body);
  } else {
    db.prepare("SELECT id FROM users WHERE role = 'hr'").all()
      .forEach(u => notify(u.id, 'leave.submitted', title, body));
  }
  audit(req.user.id, 'leave.submit', `#${info.lastInsertRowid}`);
  res.status(201).json(db.prepare(`${SELECT} WHERE l.id = ?`).get(info.lastInsertRowid));
});

function decide(req, res, status) {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });
  if (row.status !== 'pending') return res.status(409).json({ error: 'This request was already decided.' });
  if (req.user.role === 'manager' && row.department_id !== req.employee?.department_id) {
    return res.status(403).json({ error: 'You can only act on your own department requests.' });
  }
  const rejectionReason = status === 'rejected' ? (req.body?.rejection_reason || null) : null;
  db.prepare("UPDATE leave_requests SET status=?, decided_by=?, decided_at=datetime('now'), rejection_reason=? WHERE id=?")
    .run(status, req.employee?.id ?? null, rejectionReason, row.id);

  const emp = db.prepare('SELECT user_id, full_name FROM employees WHERE id = ?').get(row.employee_id);
  const notifBody = rejectionReason
    ? `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) was rejected. Reason: ${rejectionReason}`
    : `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) was ${status}.`;
  notify(emp?.user_id, `leave.${status}`, `Leave ${status}`, notifBody);
  audit(req.user.id, `leave.${status}`, `#${row.id}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
}

router.post('/:id/approve', require('leave.approve'), (req, res) => decide(req, res, 'approved'));
router.post('/:id/reject', require('leave.approve'), (req, res) => decide(req, res, 'rejected'));

// HR/admin can change status of any leave request after the fact.
router.patch('/:id', require('leave.edit'), (req, res) => {
  const { status, rejection_reason, paid_status } = req.body || {};
  if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (pending, approved, rejected) is required.' });
  }
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });
  const reason = status === 'rejected' ? (rejection_reason || null) : null;
  const ps = paid_status === 'paid' || paid_status === 'unpaid' ? paid_status : (row.paid_status || null);
  db.prepare("UPDATE leave_requests SET status=?, rejection_reason=?, paid_status=?, decided_by=?, decided_at=datetime('now') WHERE id=?")
    .run(status, reason, ps, req.employee?.id ?? null, row.id);
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(row.employee_id);
  const notifBody = reason
    ? `Your ${row.leave_type} leave was updated to ${status}. Reason: ${reason}`
    : `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) has been updated to ${status}.`;
  notify(emp?.user_id, `leave.${status}`, `Leave ${status}`, notifBody);
  audit(req.user.id, 'leave.status_change', `#${row.id} -> ${status}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
});

export default router;
