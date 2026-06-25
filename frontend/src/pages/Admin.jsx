// src/pages/Admin.jsx
// Admin panel: shifts (HR + super_admin), departments + users (super_admin only).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const ROLES = ['super_admin', 'hr', 'manager', 'employee'];

export default function Admin() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const tabs = isSuperAdmin ? ['shifts', 'departments', 'users'] : ['shifts'];
  const [tab, setTab] = useState('shifts');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin Panel</h1>
          <p>{isSuperAdmin ? 'Manage shifts, departments and user accounts.' : 'Manage work shifts.'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map((t) => (
          <button key={t} className={`btn ${tab === t ? '' : 'ghost'}`}
            style={{ textTransform: 'capitalize' }} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'shifts' && <Shifts />}
      {tab === 'departments' && isSuperAdmin && <Departments />}
      {tab === 'users' && isSuperAdmin && <Users />}
    </>
  );
}

function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api.shifts().then(setShifts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setError(''); setMsg('');
    if (!name.trim()) return setError('Shift name is required.');
    try { await api.createShift(name.trim()); setName(''); setMsg('Shift added.'); load(); }
    catch (e) { setError(e.message); }
  };

  const remove = async (s) => {
    if (!confirm(`Delete shift "${s.name}"?`)) return;
    setError(''); setMsg('');
    try { await api.deleteShift(s.id); setMsg(`"${s.name}" deleted.`); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="card">
      <h2>Work shifts</h2>
      {error && <div className="error">{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '8px 0', fontSize: 14 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '0 18px' }}>
        <input placeholder="New shift name (e.g. Morning 9am-5pm)"
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8 }} />
        <button className="btn" onClick={add}>Add shift</button>
      </div>
      {shifts.length === 0 ? <div className="empty">No shifts defined yet.</div> : (
        <table>
          <thead><tr><th>Shift name</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{(s.created_at || '').slice(0, 10)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn no sm" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Departments() {
  const [depts, setDepts] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api.adminDepts().then(setDepts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setError(''); setMsg('');
    if (!name.trim()) return setError('Department name is required.');
    try { await api.createDept(name.trim()); setName(''); setMsg('Department added.'); load(); }
    catch (e) { setError(e.message); }
  };

  const remove = async (d) => {
    if (!confirm(`Delete department "${d.name}"? This cannot be undone.`)) return;
    setError(''); setMsg('');
    try { await api.deleteDept(d.id); setMsg(`"${d.name}" deleted.`); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="card">
      <h2>Departments</h2>
      {error && <div className="error">{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '8px 0', fontSize: 14 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="New department name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1 }} />
        <button className="btn" onClick={add}>Add</button>
      </div>
      {depts.length === 0 ? <div className="empty">No departments yet.</div> : (
        <table>
          <thead><tr><th>Name</th><th></th></tr></thead>
          <tbody>
            {depts.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn no sm" onClick={() => remove(d)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const load = () => api.adminUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    setError(''); setMsg('');
    try {
      await api.updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
      setMsg(`${u.email} ${u.is_active ? 'deactivated' : 'activated'}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (u) => {
    if (!confirm(`Delete user "${u.email}"? This cannot be undone.`)) return;
    setError(''); setMsg('');
    try { await api.deleteUser(u.id); setMsg(`${u.email} deleted.`); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="card">
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        User accounts
        <button className="btn sm" onClick={() => setShowAdd(true)}>Create user</button>
      </h2>
      {error && <div className="error">{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '8px 0', fontSize: 14 }}>{msg}</div>}
      {users.length === 0 ? <div className="empty">No users found.</div> : (
        <table>
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.full_name || '—'}</td>
                <td><span className="tag approved" style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</span></td>
                <td><span className={`tag ${u.is_active ? 'approved' : 'rejected'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setEditUser(u)}>Edit</button>{' '}
                  <button className="btn ghost sm" onClick={() => toggleActive(u)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>{' '}
                  <button className="btn no sm" onClick={() => remove(u)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showAdd && <CreateUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onSaved }) {
  const [f, setF] = useState({ email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setError('');
    try { await api.createUser(f); onSaved(); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create user account</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Email *</label><input type="email" value={f.email} onChange={set('email')} /></div>
          <div className="field"><label>Password *</label><input type="password" value={f.password} onChange={set('password')} /></div>
          <div className="field"><label>Role</label>
            <select value={f.role} onChange={set('role')}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Create account</button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    const body = { role };
    if (password) body.password = password;
    try { await api.updateUser(user.id, body); onSaved(); }
    catch (e) { setError(e.message); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit user — {user.email}</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="field"><label>New password (leave blank to keep current)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
