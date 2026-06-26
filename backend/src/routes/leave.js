// src/routes/leave.js
// Multi-step leave workflow:
//   employee submits -> pending
//   HR sends to manager -> sent_to_manager
//   manager reviews -> manager_approved | manager_rejected
//   HR final decision -> approved | rejected
import { Router } from 'express';
import db, { audit, notify } from '../db.js';
import { authenticate, can } from '../auth.js';

const router = Router();
router.use(authenticate);

const SELECT = `
  SELECT l.*, e.full_name AS employee_name, e.department_id,
    me.full_name AS assigned_manager_name
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN employees me ON me.user_id = l.assigned_manager_id
`;

// ── Leave quotas (allowances) ────────────────────────────────────────────────
// Subquery to compute used days from approved requests within the quota's year
const USAGE_SUB = `COALESCE((
  SELECT CAST(SUM(julianday(l2.end_date) - julianday(l2.start_date) + 1) AS INTEGER)
  FROM leave_requests l2
  WHERE l2.employee_id = q.employee_id
    AND l2.leave_type  = q.leave_type
    AND l2.status      = 'approved'
    AND strftime('%Y', l2.start_date) = CAST(q.year AS TEXT)
), 0) AS used_days`;

router.get('/quotas', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const empId = req.query.employee_id ? Number(req.query.employee_id) : null;

  if (req.user.role === 'employee') {
    if (!req.employee) return res.json([]);
    return res.json(
      db.prepare(`SELECT q.*, ${USAGE_SUB} FROM leave_quotas q
        WHERE q.employee_id = ? AND q.year = ? ORDER BY q.leave_type`)
        .all(req.employee.id, year)
    );
  }

  if (req.user.role !== 'hr' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'HR access required.' });

  let sql = `SELECT q.*, e.full_name AS employee_name, d.name AS department_name, ${USAGE_SUB}
    FROM leave_quotas q
    JOIN employees e ON e.id = q.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE q.year = ?`;
  const params = [year];
  if (empId) { sql += ' AND q.employee_id = ?'; params.push(empId); }
  sql += ' ORDER BY e.full_name, q.leave_type';
  res.json(db.prepare(sql).all(...params));
});

router.post('/quotas/set', (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'HR access required.' });
  const { employee_id, leave_type, year, total_days } = req.body || {};
  if (!employee_id || !leave_type || total_days == null)
    return res.status(400).json({ error: 'employee_id, leave_type, and total_days are required.' });
  const TYPES = ['annual', 'casual', 'sick', 'unpaid'];
  if (!TYPES.includes(leave_type)) return res.status(400).json({ error: 'Invalid leave_type.' });
  const yr = Number(year) || new Date().getFullYear();
  db.prepare(`
    INSERT INTO leave_quotas (employee_id, leave_type, year, total_days, created_by, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(employee_id, leave_type, year) DO UPDATE SET
      total_days = excluded.total_days, created_by = excluded.created_by,
      updated_at = datetime('now')
  `).run(Number(employee_id), leave_type, yr, Number(total_days), req.user.id);
  audit(req.user.id, 'leave.quota.set', `emp#${employee_id} ${leave_type} ${yr}: ${total_days}d`);
  res.json({ ok: true });
});

// ── List active managers (for HR's send-to-manager dropdown) ─────────────────
router.get('/meta/managers', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id AS user_id, e.full_name, e.designation, d.name AS department_name
    FROM users u
    JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE u.role = 'manager' AND u.is_active = 1
    ORDER BY e.full_name
  `).all();
  res.json(rows);
});

// ── GET all / own / assigned ─────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { role } = req.user;
  let rows;
  if (role === 'super_admin' || role === 'hr') {
    rows = db.prepare(`${SELECT} ORDER BY l.created_at DESC`).all();
  } else if (role === 'manager') {
    // Managers see ALL their team's leave requests + any HR sent to them for review
    const mEmpId = req.employee?.id ?? -1;
    rows = db.prepare(`${SELECT}
      WHERE (e.manager_id = ? OR l.assigned_manager_id = ?)
      ORDER BY l.created_at DESC`)
      .all(mEmpId, req.user.id);
  } else {
    rows = db.prepare(`${SELECT} WHERE l.employee_id = ? ORDER BY l.created_at DESC`)
      .all(req.employee?.id ?? -1);
  }
  res.json(rows);
});

// ── Employee submits leave ───────────────────────────────────────────────────
router.post('/', (req, res) => {
  if (!can(req.user.role, 'leave.submit')) return res.status(403).json({ error: 'Forbidden.' });
  const { leave_type, start_date, end_date, reason } = req.body || {};
  if (!req.employee) return res.status(400).json({ error: 'No employee profile linked to this account.' });
  if (!leave_type || !start_date || !end_date)
    return res.status(400).json({ error: 'Leave type, start date and end date are required.' });

  const paid_status = req.body.paid_status === 'unpaid' ? 'unpaid' : 'paid';
  const info = db.prepare(
    'INSERT INTO leave_requests (employee_id,leave_type,start_date,end_date,reason,paid_status) VALUES (?,?,?,?,?,?)'
  ).run(req.employee.id, leave_type, start_date, end_date, reason ?? null, paid_status);

  // Notify HR — leave lands with HR first, not manager
  const title = `Leave request from ${req.employee.full_name}`;
  const body = `${leave_type} leave, ${start_date} to ${end_date}.`;
  db.prepare("SELECT id FROM users WHERE role IN ('hr','super_admin') AND is_active=1").all()
    .forEach(u => notify(u.id, 'leave.submitted', title, body));
  audit(req.user.id, 'leave.submit', `#${info.lastInsertRowid}`);
  res.status(201).json(db.prepare(`${SELECT} WHERE l.id = ?`).get(info.lastInsertRowid));
});

// ── HR sends leave to a specific manager for their input ─────────────────────
router.post('/:id/send-to-manager', (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'HR access required.' });

  const { manager_id, hr_comment } = req.body || {};
  if (!manager_id) return res.status(400).json({ error: 'manager_id is required.' });

  const manager = db.prepare("SELECT * FROM users WHERE id=? AND role='manager' AND is_active=1").get(manager_id);
  if (!manager) return res.status(400).json({ error: 'Selected user is not a valid active manager.' });

  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });
  if (row.status !== 'pending')
    return res.status(409).json({ error: `Cannot send to manager — current status is '${row.status}'.` });

  db.prepare(
    "UPDATE leave_requests SET status='sent_to_manager', assigned_manager_id=?, hr_comment=? WHERE id=?"
  ).run(manager_id, hr_comment || null, row.id);

  const emp = db.prepare('SELECT full_name FROM employees WHERE id=?').get(row.employee_id);
  notify(
    manager_id, 'leave.review_requested', 'Leave review requested',
    `HR requests your review of ${emp?.full_name || 'an employee'}'s ` +
    `${row.leave_type} leave (${row.start_date} to ${row.end_date}).` +
    (hr_comment ? ` Note: ${hr_comment}` : '')
  );
  audit(req.user.id, 'leave.sent_to_manager', `#${row.id} -> manager user #${manager_id}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
});

// ── Manager submits their recommendation ────────────────────────────────────
router.post('/:id/manager-review', (req, res) => {
  if (req.user.role !== 'manager')
    return res.status(403).json({ error: 'Manager access required.' });

  const { decision, comment } = req.body || {};
  if (!['approved', 'rejected'].includes(decision))
    return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'." });

  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });
  if (row.status !== 'sent_to_manager')
    return res.status(409).json({ error: 'This leave is not pending your review.' });
  if (row.assigned_manager_id !== req.user.id)
    return res.status(403).json({ error: 'This leave was not sent to you for review.' });

  const newStatus = decision === 'approved' ? 'manager_approved' : 'manager_rejected';
  db.prepare('UPDATE leave_requests SET status=?, manager_comment=? WHERE id=?')
    .run(newStatus, comment || null, row.id);

  // Notify HR
  const emp = db.prepare('SELECT full_name FROM employees WHERE id=?').get(row.employee_id);
  const mgr = db.prepare('SELECT full_name FROM employees WHERE user_id=?').get(req.user.id);
  const verdict = decision === 'approved' ? 'recommended approval for' : 'recommended rejection of';
  db.prepare("SELECT id FROM users WHERE role IN ('hr','super_admin') AND is_active=1").all()
    .forEach(u => notify(u.id, `leave.manager_${decision}`,
      `Manager ${decision === 'approved' ? 'approved' : 'rejected'} leave`,
      `${mgr?.full_name || 'Manager'} has ${verdict} ${emp?.full_name || 'employee'}'s ` +
      `${row.leave_type} leave (${row.start_date} to ${row.end_date}).` +
      (comment ? ` Comment: ${comment}` : '')
    ));
  audit(req.user.id, `leave.manager_${decision}`, `#${row.id}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
});

// ── HR final approval ────────────────────────────────────────────────────────
const DECIDABLE = ['pending', 'manager_approved', 'manager_rejected'];

function finalDecide(req, res, status) {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });
  if (!DECIDABLE.includes(row.status))
    return res.status(409).json({ error: `Cannot decide — current status is '${row.status}'.` });

  const rejectionReason = status === 'rejected' ? (req.body?.rejection_reason || null) : null;
  db.prepare(
    "UPDATE leave_requests SET status=?, decided_by=?, decided_at=datetime('now'), rejection_reason=? WHERE id=?"
  ).run(status, req.employee?.id ?? null, rejectionReason, row.id);

  const emp = db.prepare('SELECT user_id, full_name FROM employees WHERE id=?').get(row.employee_id);
  const notifBody = rejectionReason
    ? `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) was rejected. Reason: ${rejectionReason}`
    : `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) was ${status}.`;
  notify(emp?.user_id, `leave.${status}`, `Leave ${status}`, notifBody);
  audit(req.user.id, `leave.${status}`, `#${row.id}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
}

router.post('/:id/approve', (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'HR access required for final approval.' });
  finalDecide(req, res, 'approved');
});

router.post('/:id/reject', (req, res) => {
  if (req.user.role !== 'hr' && req.user.role !== 'super_admin')
    return res.status(403).json({ error: 'HR access required for final rejection.' });
  finalDecide(req, res, 'rejected');
});

// ── HR edit (paid status, override status, etc.) ─────────────────────────────
router.patch('/:id', (req, res) => {
  if (!can(req.user.role, 'leave.edit')) return res.status(403).json({ error: 'Forbidden.' });
  const { status, rejection_reason, paid_status } = req.body || {};
  const valid = ['pending','approved','rejected','sent_to_manager','manager_approved','manager_rejected'];
  if (!status || !valid.includes(status))
    return res.status(400).json({ error: 'Valid status is required.' });

  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Leave request not found.' });

  const reason = status === 'rejected' ? (rejection_reason || null) : null;
  const ps = ['paid','unpaid'].includes(paid_status) ? paid_status : (row.paid_status || null);
  db.prepare(
    "UPDATE leave_requests SET status=?, rejection_reason=?, paid_status=?, decided_by=?, decided_at=datetime('now') WHERE id=?"
  ).run(status, reason, ps, req.employee?.id ?? null, row.id);

  if (status === 'approved' || status === 'rejected') {
    const emp = db.prepare('SELECT user_id FROM employees WHERE id=?').get(row.employee_id);
    notify(emp?.user_id, `leave.${status}`, `Leave ${status}`,
      `Your ${row.leave_type} leave (${row.start_date} to ${row.end_date}) has been updated to ${status}.`);
  }
  audit(req.user.id, 'leave.status_change', `#${row.id} -> ${status}`);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(row.id));
});

export default router;
