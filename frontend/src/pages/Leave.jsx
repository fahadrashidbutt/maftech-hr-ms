// src/pages/Leave.jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const LEAVE_TYPES = [
  { v: 'annual', l: 'Annual' }, { v: 'casual', l: 'Casual' },
  { v: 'sick', l: 'Sick' }, { v: 'unpaid', l: 'Unpaid' },
];

const STATUS_CFG = {
  pending:           { label: 'Pending',          cls: 'pending'  },
  sent_to_manager:   { label: 'Awaiting Manager', cls: 'pending'  },
  manager_approved:  { label: 'Mgr. Approved',    cls: 'hired'    },
  manager_rejected:  { label: 'Mgr. Rejected',    cls: 'rejected' },
  approved:          { label: 'Approved',          cls: 'approved' },
  rejected:          { label: 'Rejected',          cls: 'rejected' },
};

const EMP_STATUS_CFG = {
  pending:           { label: 'Pending',      cls: 'pending'  },
  sent_to_manager:   { label: 'Under Review', cls: 'pending'  },
  manager_approved:  { label: 'Under Review', cls: 'pending'  },
  manager_rejected:  { label: 'Under Review', cls: 'pending'  },
  approved:          { label: 'Approved',     cls: 'approved' },
  rejected:          { label: 'Rejected',     cls: 'rejected' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${+day} ${MONTHS[+m - 1]} ${y}`;
}

const THIS_YEAR = new Date().getFullYear();

// ── Balance bar component ─────────────────────────────────────────────────────
function BalanceCard({ quota }) {
  const used = quota.used_days || 0;
  const total = quota.total_days || 0;
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = pct >= 90 ? 'var(--danger)' : pct >= 65 ? 'var(--warn)' : 'var(--teal-500)';
  return (
    <div className="balance-card">
      <div className="balance-type">{quota.leave_type} leave</div>
      <div className="balance-bar-wrap">
        <div className="balance-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="balance-nums">
        <span className="balance-remaining">{remaining} days left</span>
        <span className="balance-used">{used}/{total} used</span>
      </div>
    </div>
  );
}

// ── Main Leave page ───────────────────────────────────────────────────────────
export default function Leave() {
  const { can, user } = useAuth();
  const isHR      = user?.role === 'hr' || user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';
  const canEdit   = can('leave.edit');

  const [activeTab, setActiveTab] = useState('requests');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leave</h1>
          <p>
            {isHR      ? 'Review requests, manage leave allowances, and consult managers.'
            : isManager ? 'View your team\'s leave history and review requests HR assigns to you.'
            : 'Submit and track your leave requests.'}
          </p>
        </div>
        {isEmployee && can('leave.submit') && (
          <button className="btn" onClick={() => document.dispatchEvent(new CustomEvent('leave:new'))}>
            Request leave
          </button>
        )}
      </div>

      {isHR && (
        <div className="page-tabs">
          <button className={`page-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}>Requests</button>
          <button className={`page-tab ${activeTab === 'allowances' ? 'active' : ''}`}
            onClick={() => setActiveTab('allowances')}>Leave Allowances</button>
        </div>
      )}

      {(!isHR || activeTab === 'requests') && (
        <RequestsView isHR={isHR} isManager={isManager} isEmployee={isEmployee} canEdit={canEdit} can={can} />
      )}
      {isHR && activeTab === 'allowances' && <AllowancesTab />}
    </>
  );
}

// ── Requests view ─────────────────────────────────────────────────────────────
function RequestsView({ isHR, isManager, isEmployee, canEdit, can }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [quotas, setQuotas] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [rejectTarget, setRejectTarget]   = useState(null);
  const [editTarget,   setEditTarget]     = useState(null);
  const [sendTarget,   setSendTarget]     = useState(null);
  const [reviewTarget, setReviewTarget]   = useState(null);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterPaid,   setFilterPaid]   = useState('');

  const load = () => api.leave().then(setRows).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    if (isEmployee) api.leaveQuotas(null, THIS_YEAR).then(setQuotas).catch(() => {});
    // Listen for the "new request" trigger from the page header button
    const handler = () => setShowForm(true);
    document.addEventListener('leave:new', handler);
    return () => document.removeEventListener('leave:new', handler);
  }, []);

  const approve = async (id) => {
    try { await api.approveLeave(id); load(); }
    catch (e) { setError(e.message); }
  };

  const sl = filterSearch.toLowerCase();
  const displayed = rows
    .filter((r) => !sl || (r.employee_name || '').toLowerCase().includes(sl))
    .filter((r) => {
      if (!filterStatus) return true;
      if (isEmployee && filterStatus === 'under_review')
        return ['sent_to_manager','manager_approved','manager_rejected'].includes(r.status);
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

  return (
    <>
      {error && <div className="error">{error}</div>}

      {/* Employee leave balance */}
      {isEmployee && quotas.length > 0 && (
        <div className="balance-grid">
          {quotas.map((q) => <BalanceCard key={q.leave_type} quota={q} />)}
        </div>
      )}
      {isEmployee && quotas.length === 0 && (
        <div style={{ background: 'var(--teal-050)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 18px', marginBottom: 18, fontSize: 13, color: 'var(--muted)' }}>
          Leave allowances have not been set for your account yet. Contact HR.
        </div>
      )}

      <div className="filter-bar">
        {!isEmployee && (
          <input placeholder="Search employee…" value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)} style={{ maxWidth: 220 }} />
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
            Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)
          )}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {LEAVE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value)}>
          <option value="">Paid &amp; Unpaid</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        {hasFilter && <button className="reset" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="card">
        {displayed.length === 0 ? (
          <div className="empty">
            {hasFilter   ? 'No requests match these filters.'
            : isManager  ? 'No leave requests from your team yet.'
            : 'No leave requests yet.'}
          </div>
        ) : (
          <>
            <div className="results-count">
              {displayed.length} of {rows.length} request{rows.length !== 1 ? 's' : ''}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {!isEmployee && <th>Employee</th>}
                    <th>Type</th>
                    <th>Period</th>
                    <th>Paid</th>
                    <th>Status</th>
                    {isHR && <th>Manager</th>}
                    {isManager && <th>HR Note</th>}
                    {!isManager && <th>Rejection note</th>}
                    <th style={{ width: 1 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => {
                    const sd = statusDisplay(r);
                    return (
                      <tr key={r.id}>
                        {!isEmployee && (
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.employee_name}</td>
                        )}
                        <td>
                          <span style={{ textTransform: 'capitalize' }}>{r.leave_type}</span>
                          {r.reason && (
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.reason}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                          {fmtDate(r.start_date)}<br />
                          <span style={{ color: 'var(--muted)' }}>{fmtDate(r.end_date)}</span>
                        </td>
                        <td>
                          {r.paid_status
                            ? <span className={`tag ${r.paid_status}`}>{r.paid_status}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td><span className={`tag ${sd.cls}`}>{sd.label}</span></td>

                        {isHR && (
                          <td className="mgr-cell">
                            {r.assigned_manager_name ? (
                              <>
                                <div className="mgr-name">{r.assigned_manager_name}</div>
                                {(r.status === 'manager_approved' || r.status === 'manager_rejected') && (
                                  <>
                                    <span className={`tag ${r.status === 'manager_approved' ? 'approved' : 'rejected'}`} style={{ fontSize: 11 }}>
                                      {r.status === 'manager_approved' ? '✓ Approve' : '✗ Reject'}
                                    </span>
                                    {r.manager_comment && (
                                      <div className="mgr-quote" title={r.manager_comment}>"{r.manager_comment}"</div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                          </td>
                        )}

                        {isManager && (
                          <td style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 180 }}>
                            {r.hr_comment || '—'}
                          </td>
                        )}

                        {!isManager && (
                          <td style={{ fontSize: 12.5, color: 'var(--muted)', maxWidth: 180 }}>
                            {r.rejection_reason || '—'}
                          </td>
                        )}

                        <td>
                          <div className="actions">
                            {isHR && r.status === 'pending' && (
                              <>
                                <button className="btn ghost sm" onClick={() => setSendTarget(r)}>→ Manager</button>
                                <button className="btn ok sm" onClick={() => approve(r.id)}>Approve</button>
                                <button className="btn no sm" onClick={() => setRejectTarget(r)}>Reject</button>
                              </>
                            )}
                            {isHR && (r.status === 'manager_approved' || r.status === 'manager_rejected') && (
                              <>
                                <button className="btn ok sm" onClick={() => approve(r.id)}>Approve</button>
                                <button className="btn no sm" onClick={() => setRejectTarget(r)}>Reject</button>
                              </>
                            )}
                            {isHR && canEdit && (
                              <button className="btn ghost sm" onClick={() => setEditTarget(r)}>Edit</button>
                            )}
                            {isManager && r.status === 'sent_to_manager' && (
                              <button className="btn sm" onClick={() => setReviewTarget(r)}>Review</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showForm && <LeaveForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {rejectTarget && <RejectModal row={rejectTarget} onClose={() => setRejectTarget(null)} onRejected={() => { setRejectTarget(null); load(); }} onError={(m) => setError(m)} />}
      {editTarget && <EditLeaveModal row={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} onError={(m) => setError(m)} />}
      {sendTarget && <SendToManagerModal row={sendTarget} onClose={() => setSendTarget(null)} onSent={() => { setSendTarget(null); load(); }} onError={(m) => setError(m)} />}
      {reviewTarget && <ManagerReviewModal row={reviewTarget} onClose={() => setReviewTarget(null)} onReviewed={() => { setReviewTarget(null); load(); }} onError={(m) => setError(m)} />}
    </>
  );
}

// ── Allowances tab (HR only) ──────────────────────────────────────────────────
function AllowancesTab() {
  const [employees, setEmployees] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [year, setYear] = useState(THIS_YEAR);
  const [target, setTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [depts, setDepts] = useState([]);

  const loadQuotas = (yr) => api.leaveQuotas(null, yr).then(setQuotas).catch(() => {});

  useEffect(() => {
    api.employees('').then(setEmployees).catch(() => {});
    api.departments().then(setDepts).catch(() => {});
    loadQuotas(year);
  }, []);

  const changeYear = (yr) => { setYear(yr); loadQuotas(yr); };

  // Build a map: employee_id → { annual: quota, casual: quota, ... }
  const quotaMap = {};
  quotas.forEach((q) => {
    if (!quotaMap[q.employee_id]) quotaMap[q.employee_id] = {};
    quotaMap[q.employee_id][q.leave_type] = q;
  });

  const sl = search.toLowerCase();
  const displayed = employees
    .filter((e) => !sl || e.full_name.toLowerCase().includes(sl) || (e.designation || '').toLowerCase().includes(sl))
    .filter((e) => !filterDept || (e.department_name || '') === filterDept);

  const yearOpts = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];

  return (
    <>
      <div className="filter-bar">
        <input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={year} onChange={(e) => changeYear(Number(e.target.value))}>
          {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {(search || filterDept) && <button className="reset" onClick={() => { setSearch(''); setFilterDept(''); }}>Clear</button>}
      </div>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Annual</th>
                <th>Casual</th>
                <th>Sick</th>
                <th>Unpaid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((e) => {
                const eq = quotaMap[e.id] || {};
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.full_name}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.department_name || '—'}</td>
                    {['annual','casual','sick','unpaid'].map((t) => (
                      <td key={t} className="quota-day">
                        {eq[t] ? (
                          <>
                            <strong>{eq[t].total_days}d</strong>
                            <div className="used">{eq[t].used_days} used</div>
                          </>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    ))}
                    <td>
                      <button className="btn ghost sm"
                        onClick={() => setTarget({ emp: e, eq })}>
                        Set Quotas
                      </button>
                    </td>
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan="7"><div className="empty">No employees match.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <QuotaModal emp={target.emp} currentQuotas={target.eq} year={year}
          onClose={() => setTarget(null)}
          onSaved={() => { setTarget(null); loadQuotas(year); }} />
      )}
    </>
  );
}

function QuotaModal({ emp, currentQuotas, year, onClose, onSaved }) {
  const [days, setDays] = useState({
    annual: currentQuotas.annual?.total_days ?? '',
    casual: currentQuotas.casual?.total_days ?? '',
    sick:   currentQuotas.sick?.total_days   ?? '',
    unpaid: currentQuotas.unpaid?.total_days ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(''); setSaving(true);
    try {
      await Promise.all(
        Object.entries(days)
          .filter(([, v]) => v !== '' && v !== undefined && v !== null)
          .map(([t, v]) => api.setLeaveQuota(emp.id, t, year, Number(v)))
      );
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Leave Allowances — {emp.full_name} ({year})</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            Set the number of days allowed per leave type for {year}.
            Leave blank to remove or not set a quota.
          </p>
          <div className="grid-2">
            {LEAVE_TYPES.map((t) => (
              <div className="field" key={t.v}>
                <label>{t.l} Leave (days)</label>
                <input type="number" min="0" max="365" value={days[t.v]}
                  onChange={(e) => setDays({ ...days, [t.v]: e.target.value })}
                  placeholder="—" />
                {currentQuotas[t.v] && (
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                    Used: {currentQuotas[t.v].used_days} of {currentQuotas[t.v].total_days} days
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Allowances'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modals (send to manager, manager review, reject, edit, submit) ─────────────

function SendToManagerModal({ row, onClose, onSent, onError }) {
  const [managers, setManagers] = useState([]);
  const [managerId, setManagerId] = useState('');
  const [comment,   setComment]   = useState('');
  const [error,     setError]     = useState('');

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
            <strong>{row.employee_name}</strong> — <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span> leave &nbsp;
            ({fmtDate(row.start_date)} → {fmtDate(row.end_date)})
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
            <textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Any context or instructions for the manager…" />
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

function ManagerReviewModal({ row, onClose, onReviewed, onError }) {
  const [decision, setDecision] = useState('approved');
  const [comment,  setComment]  = useState('');
  const [error,    setError]    = useState('');

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
            <strong>{row.employee_name}</strong> — <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span> leave &nbsp;
            ({fmtDate(row.start_date)} → {fmtDate(row.end_date)})
          </p>
          {row.hr_comment && (
            <div style={{ background: 'var(--teal-050)', border: '1px solid var(--line)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <strong style={{ color: 'var(--teal-700)' }}>Note from HR:</strong> {row.hr_comment}
            </div>
          )}
          <div className="field">
            <label>Your recommendation *</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="approved">Recommend Approval — work is covered</option>
              <option value="rejected">Recommend Rejection — capacity concern</option>
            </select>
          </div>
          <div className="field">
            <label>Comment for HR (optional)</label>
            <textarea rows="3" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Help HR make the final call…" />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${decision === 'approved' ? 'ok' : 'no'}`} onClick={submit}>
            {decision === 'approved' ? 'Recommend Approval' : 'Recommend Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ row, onClose, onRejected, onError }) {
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');

  const confirm = async () => {
    setError('');
    try { await api.rejectLeave(row.id, reason); onRejected(); }
    catch (e) { setError(e.message); onError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reject Leave</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
            Rejecting <strong>{row.employee_name}</strong>'s{' '}
            <span style={{ textTransform: 'capitalize' }}>{row.leave_type}</span> leave &nbsp;
            ({fmtDate(row.start_date)} → {fmtDate(row.end_date)}).
          </p>
          {row.manager_comment && (
            <div style={{ background: '#fbe6e4', border: '1px solid #f0cfcc', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <strong>Manager's comment:</strong> {row.manager_comment}
            </div>
          )}
          <div className="field">
            <label>Reason (optional — visible to the employee)</label>
            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason…" />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn no" onClick={confirm}>Confirm Rejection</button>
        </div>
      </div>
    </div>
  );
}

function EditLeaveModal({ row, onClose, onSaved, onError }) {
  const [status,     setStatus]     = useState(row.status);
  const [paidStatus, setPaidStatus] = useState(row.paid_status || 'paid');
  const [reason,     setReason]     = useState(row.rejection_reason || '');
  const [error,      setError]      = useState('');

  const save = async () => {
    setError('');
    try { await api.editLeaveStatus(row.id, status, reason, paidStatus); onSaved(); }
    catch (e) { setError(e.message); onError(e.message); }
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
            ({fmtDate(row.start_date)} → {fmtDate(row.end_date)})
          </p>
          <div className="grid-2">
            <div className="field">
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Paid / Unpaid</label>
              <select value={paidStatus} onChange={(e) => setPaidStatus(e.target.value)}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
          {status === 'rejected' && (
            <div className="field">
              <label>Rejection reason</label>
              <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} />
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

function LeaveForm({ onClose, onSaved }) {
  const [f, setF] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '', paid_status: 'paid' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError('');
    if (!f.start_date || !f.end_date) return setError('Start and end date are required.');
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
            <div className="field">
              <label>Leave type</label>
              <select value={f.leave_type} onChange={set('leave_type')}>
                {LEAVE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Paid / Unpaid</label>
              <select value={f.paid_status} onChange={set('paid_status')}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="field">
              <label>From *</label>
              <input type="date" value={f.start_date} onChange={set('start_date')} />
            </div>
            <div className="field">
              <label>To *</label>
              <input type="date" value={f.end_date} onChange={set('end_date')} />
            </div>
          </div>
          <div className="field">
            <label>Reason</label>
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
