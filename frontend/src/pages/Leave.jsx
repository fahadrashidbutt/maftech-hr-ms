// src/pages/Leave.jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const LEAVE_TYPES = [
  { v: 'annual', l: 'Annual' }, { v: 'casual', l: 'Casual' },
  { v: 'sick', l: 'Sick' }, { v: 'unpaid', l: 'Unpaid' },
];

export default function Leave() {
  const { can, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  // filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPaid, setFilterPaid] = useState('');

  const load = () => api.leave().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api.approveLeave(id); load(); }
    catch (e) { setError(e.message); }
  };

  const canEdit = can('leave.edit');
  const canApprove = can('leave.approve');

  const sl = filterSearch.toLowerCase();
  const displayed = rows
    .filter((r) => !sl || (r.employee_name || '').toLowerCase().includes(sl))
    .filter((r) => !filterStatus || r.status === filterStatus)
    .filter((r) => !filterType || r.leave_type === filterType)
    .filter((r) => !filterPaid || r.paid_status === filterPaid);

  const hasFilter = filterSearch || filterStatus || filterType || filterPaid;
  const clearFilters = () => { setFilterSearch(''); setFilterStatus(''); setFilterType(''); setFilterPaid(''); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leave</h1>
          <p>{canApprove ? 'Review and decide on requests.' : 'Submit and track your leave.'}</p>
        </div>
        {user?.role === 'employee' && can('leave.submit') && (
          <button className="btn" onClick={() => setShowForm(true)}>Request leave</button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="filter-bar">
        {canApprove && (
          <input placeholder="Search employee name…"
            value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
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
          <div className="empty">{hasFilter ? 'No requests match these filters.' : 'No leave requests yet.'}</div>
        ) : (
          <>
            <div className="results-count">{displayed.length} of {rows.length} request{rows.length !== 1 ? 's' : ''}</div>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Rejection reason</th>
                  {(canApprove || canEdit) && <th></th>}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employee_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.leave_type}</td>
                    <td>{r.start_date}</td>
                    <td>{r.end_date}</td>
                    <td>{r.reason || '—'}</td>
                    <td>
                      {r.paid_status ? (
                        <span className={`tag ${r.paid_status === 'paid' ? 'approved' : 'pending'}`}>
                          {r.paid_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td><span className={`tag ${r.status}`}>{r.status}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{r.rejection_reason || '—'}</td>
                    {(canApprove || canEdit) && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {r.status === 'pending' && canApprove && (
                          <>
                            <button className="btn ok sm" onClick={() => approve(r.id)}>Approve</button>{' '}
                            <button className="btn no sm" onClick={() => setRejectTarget(r)}>Reject</button>{' '}
                          </>
                        )}
                        {canEdit && (
                          <button className="btn ghost sm" onClick={() => setEditTarget(r)}>Edit</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
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
    </>
  );
}

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
        <h3>Reject leave request</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
            Rejecting <strong>{row.employee_name}</strong>'s{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            leave ({row.start_date} to {row.end_date}).
          </p>
          <div className="field">
            <label>Reason for rejection (optional)</label>
            <textarea rows="3" value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this leave is being rejected..." />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn no" onClick={confirm}>Reject leave</button>
        </div>
      </div>
    </div>
  );
}

function EditLeaveModal({ row, onClose, onSaved, onError }) {
  const [status, setStatus] = useState(row.status);
  const [paidStatus, setPaidStatus] = useState(row.paid_status || 'paid');
  const [reason, setReason] = useState(row.rejection_reason || '');
  const [error, setError] = useState('');

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
        <h3>Edit leave</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
            <strong>{row.employee_name}</strong> &middot;{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span>{' '}
            ({row.start_date} to {row.end_date})
          </p>
          <div className="grid-2">
            <div className="field"><label>Approval status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
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
          <button className="btn" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

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
        <h3>Request leave</h3>
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
          <button className="btn" onClick={save}>Submit request</button>
        </div>
      </div>
    </div>
  );
}
