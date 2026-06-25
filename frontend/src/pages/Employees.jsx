// src/pages/Employees.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Employees() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = (query = '') => api.employees(query).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-head">
        <div><h1>Employees</h1><p>Searchable company directory.</p></div>
        {can('employee.write') && <button className="btn" onClick={() => setShowAdd(true)}>Add employee</button>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input placeholder="Search by name, code, email or designation…"
          value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} />
      </div>

      <div className="card">
        {rows.length === 0 ? <div className="empty">No employees found.</div> : (
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="row-link" onClick={() => nav(`/employees/${e.id}`)}>
                  <td>{e.employee_code || '—'}</td>
                  <td>{e.full_name}</td>
                  <td>{e.department_name || '—'}</td>
                  <td>{e.designation || '—'}</td>
                  <td><span className="tag approved">{e.employment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddEmployee onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(q); }} />}
    </>
  );
}

const STATUSES = ['active', 'probation', 'on_leave', 'terminated', 'resigned'];

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
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
