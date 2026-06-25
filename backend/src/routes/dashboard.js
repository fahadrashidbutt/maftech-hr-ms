// src/routes/dashboard.js
// HR dashboard stats + event-derived notifications (birthdays, probation,
// contract/document expiry) that get generated on demand.
import { Router } from 'express';
import db, { notify } from '../db.js';
import { authenticate, require } from '../auth.js';

const router = Router();
router.use(authenticate);

router.get('/', require('dashboard.hr'), (req, res) => {
  const deptFilter = req.user.role === 'manager'
    ? 'WHERE department_id = @dept' : '';
  const dept = req.employee?.department_id ?? -1;

  const total = db.prepare(`SELECT COUNT(*) n FROM employees ${deptFilter}`).get({ dept }).n;
  const newJoiners = db.prepare(
    `SELECT COUNT(*) n FROM employees ${deptFilter ? deptFilter + ' AND' : 'WHERE'} date_of_joining >= date('now','-30 day')`
  ).get({ dept }).n;
  const onLeave = db.prepare(`
    SELECT COUNT(DISTINCT l.employee_id) n FROM leave_requests l
    JOIN employees e ON e.id = l.employee_id
    WHERE l.status='approved' AND date('now') BETWEEN l.start_date AND l.end_date
    ${req.user.role === 'manager' ? 'AND e.department_id = @dept' : ''}
  `).get({ dept }).n;
  const pendingLeave = db.prepare(`
    SELECT COUNT(*) n FROM leave_requests l JOIN employees e ON e.id = l.employee_id
    WHERE l.status='pending' ${req.user.role === 'manager' ? 'AND e.department_id = @dept' : ''}
  `).get({ dept }).n;
  const upcomingContracts = db.prepare(`
    SELECT id, full_name, date_of_termination FROM employees
    WHERE date_of_termination IS NOT NULL AND date_of_termination BETWEEN date('now') AND date('now','+30 day')
    ${deptFilter ? 'AND department_id = @dept' : ''}
    ORDER BY date_of_termination
  `).all({ dept });

  res.json({
    total_employees: total,
    new_joiners: newJoiners,
    on_leave_today: onLeave,
    pending_leave_requests: pendingLeave,
    upcoming_terminations: upcomingContracts,
  });
});

// --- Notifications ---
router.get('/notifications', (req, res) => {
  res.json(db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY is_read, created_at DESC LIMIT 50'
  ).all(req.user.id));
});

router.patch('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Generate event-based notifications for the current user (HR/admin) and
// return how many were created. In production this would be a scheduled job.
router.post('/notifications/generate', require('dashboard.hr'), (req, res) => {
  const uid = req.user.id;
  let created = 0;
  const add = (type, title, body, key) => {
    const exists = db.prepare(
      "SELECT 1 FROM notifications WHERE user_id=? AND type=? AND title=? AND date(created_at)=date('now')"
    ).get(uid, type, title);
    if (!exists) { notify(uid, type, title, body); created++; }
  };

  db.prepare(`SELECT full_name, date_of_birth FROM employees
    WHERE date_of_birth IS NOT NULL
    AND strftime('%m-%d', date_of_birth) BETWEEN strftime('%m-%d','now') AND strftime('%m-%d','now','+7 day')`)
    .all().forEach(e => add('birthday', 'Upcoming birthday', `${e.full_name} has a birthday soon.`));

  db.prepare(`SELECT full_name, probation_end FROM employees
    WHERE probation_end BETWEEN date('now') AND date('now','+14 day')`)
    .all().forEach(e => add('probation', 'Probation completing', `${e.full_name}'s probation ends ${e.probation_end}.`));

  db.prepare(`SELECT full_name, date_of_termination FROM employees
    WHERE date_of_termination BETWEEN date('now') AND date('now','+30 day')`)
    .all().forEach(e => add('contract', 'Upcoming termination', `${e.full_name}'s termination date is ${e.date_of_termination}.`));

  db.prepare(`SELECT d.doc_type, e.full_name, d.expires_on FROM documents d JOIN employees e ON e.id=d.employee_id
    WHERE d.expires_on BETWEEN date('now') AND date('now','+30 day')`)
    .all().forEach(d => add('document', 'Document expiring', `${d.doc_type} for ${d.full_name} expires ${d.expires_on}.`));

  res.json({ created });
});

export default router;
