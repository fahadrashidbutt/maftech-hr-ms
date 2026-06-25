// src/pages/Employees.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const EMP_STATUSES = ['active', 'probation', 'on_leave', 'terminated', 'resigned'];

export default function Employees() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [q, setQ] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShift, setFilterShift] = useState('');

  const load = () => api.employees('').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.departments().then(setDepts).catch(() => {});
    api.shifts().then(setShifts).catch(() => {});
  }, []);

  const ql = q.toLowerCase();
  const displayed = rows
    .filter((e) => !ql || [e.full_name, e.employee_code, e.email, e.designation]
      .some((v) => (v || '').toLowerCase().includes(ql)))
    .filter((e) => !filterDept || (e.department_name || '') === filterDept)
    .filter((e) => !filterStatus || e.employment_status === filterStatus)
    .filter((e) => !filterShift || (e.shift || '') === filterShift);

  const hasFilter = q || filterDept || filterStatus || filterShift;
  const clearFilters = () => { setQ(''); setFilterDept(''); setFilterStatus(''); setFilterShift(''); };

  return (
    <>
      <div className="page-head">
        <div><h1>Employees</h1><p>Searchable company directory.</p></div>
        {can('employee.write') && <button className="btn" onClick={() => setShowAdd(true)}>Add employee</button>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="filter-bar">
        <input placeholder="Search name, code, email, designation…"
          value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 2 }} />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">All departments</option>
          {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {EMP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
          <option value="">All shifts</option>
          {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        {hasFilter && <button className="reset" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="card">
        {displayed.length === 0 ? (
          <div className="empty">{hasFilter ? 'No employees match these filters.' : 'No employees found.'}</div>
        ) : (
          <>
            <div className="results-count">{displayed.length} of {rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Shift</th><th>Status</th></tr>
              </thead>
              <tbody>
                {displayed.map((e) => (
                  <tr key={e.id} className="row-link" onClick={() => nav(`/employees/${e.id}`)}>
                    <td>{e.employee_code || '—'}</td>
                    <td>{e.full_name}</td>
                    <td>{e.department_name || '—'}</td>
                    <td>{e.designation || '—'}</td>
                    <td>{e.shift || '—'}</td>
                    <td><span className="tag approved">{e.employment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showAdd && <AddEmployee onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </>
  );
}

const ADD_STATUSES = ['active', 'probation', 'on_leave', 'terminated', 'resigned'];

function AddEmployee({ onClose, onSaved }) {
  const [f, setF] = useState({
    full_name: '', employee_code: '', designation: '', department_id: '',
    date_of_joining: '', date_of_birth: '', gender: '', shift: '',
    salary: '', employment_status: 'active',
    date_of_termination: '', termination_reason: '',
  });
  const [depts, setDepts] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [createAccount, setCreateAccount] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.departments().then(setDepts).catch(() => {});
    api.shifts().then(setShifts).catch(() => {});
  }, []);

  const save = async () => {
    setError('');
    try {
      await api.createEmployee({
        ...f,
        department_id: f.department_id || null,
        salary: f.salary ? Number(f.salary) : null,
        create_account: createAccount,
        user_email: createAccount ? userEmail : undefined,
        user_password: createAccount ? userPassword : undefined,
      });
      onSaved();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <h3>Add employee</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Full name *</label><input value={f.full_name} onChange={set('full_name')} /></div>
          <div className="grid-2">
            <div className="field"><label>Employee code</label><input value={f.employee_code} onChange={set('employee_code')} /></div>
            <div className="field"><label>Designation</label><input value={f.designation} onChange={set('designation')} /></div>
            <div className="field"><label>Department</label>
              <select value={f.department_id} onChange={set('department_id')}>
                <option value="">—</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Gender</label>
              <select value={f.gender} onChange={set('gender')}>
                <option value="">—</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="field"><label>Date of joining</label><input type="date" value={f.date_of_joining} onChange={set('date_of_joining')} /></div>
            <div className="field"><label>Date of birth</label><input type="date" value={f.date_of_birth} onChange={set('date_of_birth')} /></div>
            <div className="field"><label>Shift</label>
              <select value={f.shift} onChange={set('shift')}>
                <option value="">—</option>
                {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Salary (PKR)</label><input type="number" value={f.salary} onChange={set('salary')} /></div>
            <div className="field"><label>Employment status</label>
              <select value={f.employment_status} onChange={set('employment_status')}>
                {ADD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Date of termination</label><input type="date" value={f.date_of_termination} onChange={set('date_of_termination')} /></div>
          </div>
          {f.date_of_termination && (
            <div className="field"><label>Reason of termination</label>
              <textarea rows="2" value={f.termination_reason} onChange={set('termination_reason')} />
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
              Create login account for this employee
            </label>
            {createAccount && (
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="field"><label>Login email *</label><input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} /></div>
                <div className="field"><label>Password *</label><input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} /></div>
              </div>
            )}
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save employee</button>
        </div>
      </div>
    </div>
  );
}
