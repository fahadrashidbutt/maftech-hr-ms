// src/pages/Leave.jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const LEAVE_TYPES = [
  { v: 'annual', l: 'Annual' }, { v: 'casual', l: 'Casual' },
  { v: 'sick', l: 'Sick' }, { v: 'unpaid', l: 'Unpaid' },
];

// Status display config for HR / Manager
const STATUS_CFG = {
  pending:           { label: 'Pending',            cls: 'pending'  },
  sent_to_manager:   { label: 'Awaiting Manager',   cls: 'pending'  },
  manager_approved:  { label: 'Mgr. Approved',      cls: 'hired'    },
  manager_rejected:  { label: 'Mgr. Rejected',      cls: 'rejected' },
  approved:          { label: 'Approved',            cls: 'approved' },
  rejected:          { label: 'Rejected',            cls: 'rejected' },
};

// Simplified status display for employees (hide internal workflow)
const EMP_STATUS_CFG = {
  pending:           { label: 'Pending',      cls: 'pending'  },
  sent_to_manager:   { label: 'Under Review', cls: 'pending'  },
  manager_approved:  { label: 'Under Review', cls: 'pending'  },
  manager_rejected:  { label: 'Under Review', cls: 'pending'  },
  approved:          { label: 'Approved',     cls: 'approved' },
  rejected:          { label: 'Rejected',     cls: 'rejected' },
};

export default function Leave() {
  const { can, user } = useAuth();
  const isHR      = user?.role === 'hr' || user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const canEdit   = can('leave.edit');

  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [rejectTarget, setRejectTarget]   = useState(null);
  const [editTarget, setEditTarget]       = useState(null);
  const [sendTarget, setSendTarget]       = useState(null);
  const [reviewTarget, setReviewTarget]   = useState(null);

  // filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterPaid,   setFilterPaid]   = useState('');

  const load = () => api.leave().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api.approveLeave(id); load(); }
    catch (e) { setError(e.message); }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const sl = filterSearch.toLowerCase();
  const displayed = rows
    .filter((r) => !sl || (r.employee_name || '').toLowerCase().includes(sl))
    .filter((r) => {
      if (!filterStatus) return true;
      if (isEmployee && filterStatus === 'under_review')
        return ['sent_to_manager', 'manager_approved', 'manager_rejected'].includes(r.status);
      return r.status === filterStatus;
    })
    .filter((r) => !filterType || r.leave_type === filterType)
    .filter((r) => !filterPaid || r.paid_status === filterPaid);

  const hasFilter = filterSearch || filterStatus || filterType || filterPaid;
  const clearFilters = () => { setFilterSearch(''); setFilterStatus(''); setFilterType(''); setFilterPaid(''); };

  const statusDisplay = (r) => {
    const cfg = isEmployee ? EMP_STATUS_CFG : STATUS_CFG;
    return cfg[r.status] || { label: r.status, cls: 'pending' };
  };

  // ── Action buttons ─────────────────────────────────────────────────────────
  const renderActions = (r) => {
    if (isHR) {
      return (
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {r.status === 'pending' && (
            <>
              <button className="btn ghost sm" onClick={() => setSendTarget(r)}>Send to Manager</button>{' '}
              <button className="btn ok sm" onClick={() => approve(r.id)}>Approve</button>{' '}
              <button className="btn no sm" onClick={() => setRejectTarget(r)}>Reject</button>{' '}
            </>
          )}
          {(r.status === 'manager_approved' || r.status === 'manager_rejected') && (
            <>
              <button className="btn ok sm" onClick={() => approve(r.id)}>Final Approve</button>{' '}
              <button className="btn no sm" onClick={() => setRejectTarget(r)}>Final Reject</button>{' '}
            </>
          )}
          {canEdit && <button className="btn ghost sm" onClick={() => setEditTarget(r)}>Edit</button>}
        </td>
      );
    }
    if (isManager && r.status === 'sent_to_manager') {
      return (
        <td style={{ textAlign: 'right' }}>
          <button className="btn sm" onClick={() => setReviewTarget(r)}>Review</button>
        </td>
      );
    }
    return <td />;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leave</h1>
          <p>
            {isHR     ? 'Review requests, consult managers, and make final decisions.'
            : isManager ? 'Review leave requests assigned to you by HR.'
            : 'Submit and track your leave requests.'}
          </p>
        </div>
        {isEmployee && can('leave.submit') && (
          <button className="btn" onClick={() => setShowForm(true)}>Request leave</button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="filter-bar">
        {!isEmployee && (
          <input placeholder="Search employee name…"
            value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {isEmployee ? (
            <>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </>
          ) : (
            Object.entries(STATUS_CFG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))
          )}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All leave types</option>
          {LEAVE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value)}>
          <option value="">Paid &amp; Unpaid</option>
          <option value="paid">Paid only</option>
          <option value="unpaid">Unpaid only</option>
        </select>
        {hasFilter && <button className="reset" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="card">
        {displayed.length === 0 ? (
          <div className="empty">
            {hasFilter ? 'No requests match these filters.'
              : isManager ? 'No leave requests are pending your review.'
              : 'No leave requests yet.'}
          </div>
        ) : (
          <>
            <div className="results-count">{displayed.length} of {rows.length} request{rows.length !== 1 ? 's' : ''}</div>
            <table>
              <thead>
                <tr>
                  {!isEmployee && <th>Employee</th>}
                  <th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Paid</th>
                  <th>Status</th>
                  {isHR && <th>Manager Input</th>}
                  {isManager && <th>HR Note</th>}
                  {!isManager && <th>Rejection Reason</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => {
                  const sd = statusDisplay(r);
                  return (
                    <tr key={r.id}>
                      {!isEmployee && <td>{r.employee_name}</td>}
                      <td style={{ textTransform: 'capitalize' }}>{r.leave_type}</td>
                      <td>{r.start_date}</td>
                      <td>{r.end_date}</td>
                      <td>{r.reason || '—'}</td>
                      <td>
                        {r.paid_status
                          ? <span className={`tag ${r.paid_status === 'paid' ? 'approved' : 'pending'}`}>{r.paid_status}</span>
                          : '—'}
                      </td>
                      <td><span className={`tag ${sd.cls}`}>{sd.label}</span></td>

                      {/* HR sees manager's name + their recommendation */}
                      {isHR && (
                        <td>
                          {r.assigned_manager_name ? (
                            <div style={{ fontSize: 13 }}>
                              <div style={{ color: 'var(--muted)', marginBottom: 3 }}>
                                {r.status === 'sent_to_manager'
                                  ? `Awaiting ${r.assigned_manager_name}`
                                  : r.assigned_manager_name}
                              </div>
                              {(r.status === 'manager_approved' || r.status === 'manager_rejected') && (
                                <>
                                  <span className={`tag ${r.status === 'manager_approved' ? 'approved' : 'rejected'}`}
                                    style={{ fontSize: 11 }}>
                                    {r.status === 'manager_approved' ? 'Recommends Approve' : 'Recommends Reject'}
                                  </span>
                                  {r.manager_comment && (
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, fontStyle: 'italic' }}>
                                      "{r.manager_comment}"
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                      )}

                      {/* Manager sees HR's note */}
                      {isManager && (
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.hr_comment || '—'}</td>
                      )}

                      {/* Rejection reason for HR + Employee */}
                      {!isManager && (
                        <td style={{ fontSize: 13, color: 'var(--muted)' }}>{r.rejection_reason || '—'}</td>
                      )}

                      {renderActions(r)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showForm && (
        <LeaveForm onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
      {rejectTarget && (
        <RejectModal row={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => { setRejectTarget(null); load(); }}
          onError={(msg) => setError(msg)} />
      )}
      {editTarget && (
        <EditLeaveModal row={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
          onError={(msg) => setError(msg)} />
      )}
      {sendTarget && (
        <SendToManagerModal row={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => { setSendTarget(null); load(); }}
          onError={(msg) => setError(msg)} />
      )}
      {reviewTarget && (
        <ManagerReviewModal row={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onReviewed={() => { setReviewTarget(null); load(); }}
          onError={(msg) => setError(msg)} />
      )}
    </>
  );
}

// ── HR sends leave to a manager ───────────────────────────────────────────────
function SendToManagerModal({ row, onClose, onSent, onError }) {
  const [managers, setManagers] = useState([]);
  const [managerId, setManagerId] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.leaveManagers().then(setManagers).catch(() => {}); }, []);

  const send = async () => {
    setError('');
    if (!managerId) return setError('Please select a manager.');
    try { await api.sendToManager(row.id, Number(managerId), comment); onSent(); }
    catch (e) { setError(e.message); onError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Send for Manager Review</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 14, color: 'var(--muted)', fontSize: 13 }}>
            <strong>{row.employee_name}</strong> &mdash;{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            leave &nbsp;({row.start_date} &rarr; {row.end_date})
          </p>
          <div className="field">
            <label>Select manager *</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">— Choose a manager —</option>
              {managers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}{m.department_name ? ` (${m.department_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note to manager (optional)</label>
            <textarea rows="3" value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any context or instructions for the manager..." />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={send}>Send for Review</button>
        </div>
      </div>
    </div>
  );
}

// ── Manager submits their recommendation ──────────────────────────────────────
function ManagerReviewModal({ row, onClose, onReviewed, onError }) {
  const [decision, setDecision] = useState('approved');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try { await api.managerReview(row.id, decision, comment); onReviewed(); }
    catch (e) { setError(e.message); onError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Review Leave Request</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 14, color: 'var(--muted)', fontSize: 13 }}>
            <strong>{row.employee_name}</strong> &mdash;{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            leave &nbsp;({row.start_date} &rarr; {row.end_date})
          </p>
          {row.hr_comment && (
            <div style={{ background: 'var(--teal-050)', border: '1px solid var(--line)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <strong style={{ color: 'var(--teal-700)' }}>Note from HR:</strong>{' '}
              <span style={{ color: 'var(--ink)' }}>{row.hr_comment}</span>
            </div>
          )}
          <div className="field">
            <label>Your recommendation *</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="approved">Recommend Approval — work is covered / no issues</option>
              <option value="rejected">Recommend Rejection — team capacity concern</option>
            </select>
          </div>
          <div className="field">
            <label>Comment for HR (optional)</label>
            <textarea rows="3" value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain your recommendation to help HR make the final call..." />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${decision === 'approved' ? 'ok' : 'no'}`} onClick={submit}>
            {decision === 'approved' ? 'Submit — Recommend Approval' : 'Submit — Recommend Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HR final rejection with reason ────────────────────────────────────────────
function RejectModal({ row, onClose, onRejected, onError }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const confirm = async () => {
    setError('');
    try { await api.rejectLeave(row.id, reason); onRejected(); }
    catch (e) { setError(e.message); onError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reject Leave Request</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
            Rejecting <strong>{row.employee_name}</strong>'s{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            leave ({row.start_date} to {row.end_date}).
          </p>
          {row.manager_comment && (
            <div style={{ background: '#fbe6e4', border: '1px solid #f0cfcc', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <strong>Manager comment:</strong> {row.manager_comment}
            </div>
          )}
          <div className="field">
            <label>Rejection reason (optional)</label>
            <textarea rows="3" value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="This will be visible to the employee..." />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn no" onClick={confirm}>Reject Leave</button>
        </div>
      </div>
    </div>
  );
}

// ── HR edit modal (override any field) ───────────────────────────────────────
function EditLeaveModal({ row, onClose, onSaved, onError }) {
  const [status, setStatus]       = useState(row.status);
  const [paidStatus, setPaidStatus] = useState(row.paid_status || 'paid');
  const [reason, setReason]       = useState(row.rejection_reason || '');
  const [error, setError]         = useState('');

  const save = async () => {
    setError('');
    try {
      await api.editLeaveStatus(row.id, status, reason, paidStatus);
      onSaved();
    } catch (e) { setError(e.message); onError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit Leave</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
            <strong>{row.employee_name}</strong> &middot;{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            ({row.start_date} to {row.end_date})
          </p>
          <div className="grid-2">
            <div className="field"><label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Paid status</label>
              <select value={paidStatus} onChange={(e) => setPaidStatus(e.target.value)}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
          {status === 'rejected' && (
            <div className="field">
              <label>Rejection reason (optional)</label>
              <textarea rows="3" value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the reason for rejection..." />
            </div>
          )}
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Employee submit form ──────────────────────────────────────────────────────
function LeaveForm({ onClose, onSaved }) {
  const [f, setF] = useState({
    leave_type: 'annual', start_date: '', end_date: '',
    reason: '', paid_status: 'paid',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError('');
    try { await api.submitLeave(f); onSaved(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Request Leave</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="grid-2">
            <div className="field"><label>Leave type</label>
              <select value={f.leave_type} onChange={set('leave_type')}>
                {LEAVE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="field"><label>Paid / Unpaid</label>
              <select value={f.paid_status} onChange={set('paid_status')}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="field"><label>From</label>
              <input type="date" value={f.start_date} onChange={set('start_date')} />
            </div>
            <div className="field"><label>To</label>
              <input type="date" value={f.end_date} onChange={set('end_date')} />
            </div>
          </div>
          <div className="field"><label>Reason</label>
            <textarea rows="3" value={f.reason} onChange={set('reason')} />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Submit Request</button>
        </div>
      </div>
    </div>
  );
}
