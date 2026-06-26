// src/pages/Admin.jsx
import { useEffect, useState, Fragment } from 'react';
import { Clock, Building2, UserCog, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const ROLES = ['super_admin', 'hr', 'manager', 'employee'];

const ROLE_PERMS = {
  super_admin: ['*'],
  hr: ['employee.read','employee.write','employee.edit','leave.read','leave.approve','leave.edit','document.read','document.write','recruitment.read','recruitment.write','dashboard.hr','shift.write'],
  manager: ['employee.read','leave.read','leave.approve','dashboard.hr'],
  employee: ['employee.read.self','leave.read.self','leave.submit','document.read.self'],
};

const PERM_LABELS = {
  '*': 'Full Access',
  'employee.read': 'View Employees', 'employee.write': 'Add Employees', 'employee.edit': 'Edit Employees',
  'employee.read.self': 'Own Profile',
  'leave.read': 'View All Leave', 'leave.read.self': 'Own Leave', 'leave.approve': 'Approve Leave',
  'leave.edit': 'Edit Leave', 'leave.submit': 'Submit Leave',
  'document.read': 'View Documents', 'document.read.self': 'Own Documents', 'document.write': 'Upload Documents',
  'recruitment.read': 'View Recruitment', 'recruitment.write': 'Manage Recruitment',
  'dashboard.hr': 'HR Dashboard', 'shift.write': 'Manage Shifts',
};

const TAB_ICONS = { shifts: Clock, departments: Building2, users: UserCog, teams: Users };

export default function Admin() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isHR = user?.role === 'hr';
  const tabs = isSuperAdmin
    ? ['shifts', 'departments', 'users', 'teams']
    : isHR ? ['shifts', 'teams'] : ['shifts'];
  const [tab, setTab] = useState('shifts');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin Panel</h1>
          <p>{isSuperAdmin ? 'Manage shifts, departments, users and teams.' : 'Manage shifts and team assignments.'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button key={t} className={`btn ${tab === t ? '' : 'ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'capitalize' }}
              onClick={() => setTab(t)}>
              <Icon size={14} />{t}
            </button>
          );
        })}
      </div>
      {tab === 'shifts' && <Shifts />}
      {tab === 'departments' && isSuperAdmin && <Departments />}
      {tab === 'users' && isSuperAdmin && <UsersTab />}
      {tab === 'teams' && (isSuperAdmin || isHR) && <Teams />}
    </>
  );
}

// ── Shifts ────────────────────────────────────────────────────────────────────
function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
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

  const sl = search.toLowerCase();
  const displayed = shifts.filter((s) => !sl || s.name.toLowerCase().includes(sl));

  return (
    <div className="card">
      <h2>Work shifts</h2>
      {error && <div className="error" style={{ margin: '0 18px 12px' }}>{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '0 18px 8px', fontSize: 14 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, padding: '0 18px 14px' }}>
        <input placeholder="New shift name (e.g. Morning 9am–5pm)" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8 }} />
        <button className="btn" onClick={add}>Add shift</button>
      </div>
      <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 10 }}>
        <input placeholder="Search shifts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button className="reset" onClick={() => setSearch('')}>Clear</button>}
      </div>
      {displayed.length === 0
        ? <div className="empty">{search ? 'No shifts match.' : 'No shifts defined yet.'}</div>
        : (
          <table>
            <thead><tr><th>Shift name</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {displayed.map((s) => (
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

// ── Departments ───────────────────────────────────────────────────────────────
function Departments() {
  const [depts, setDepts] = useState([]);
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
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

  const sl = search.toLowerCase();
  const displayed = depts.filter((d) => !sl || d.name.toLowerCase().includes(sl));

  return (
    <div className="card">
      <h2>Departments</h2>
      {error && <div className="error" style={{ margin: '0 18px 12px' }}>{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '0 18px 8px', fontSize: 14 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, padding: '0 18px 14px' }}>
        <input placeholder="New department name" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8 }} />
        <button className="btn" onClick={add}>Add</button>
      </div>
      <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 10 }}>
        <input placeholder="Search departments…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button className="reset" onClick={() => setSearch('')}>Clear</button>}
      </div>
      {displayed.length === 0
        ? <div className="empty">{search ? 'No departments match.' : 'No departments yet.'}</div>
        : (
          <table>
            <thead><tr><th>Name</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {displayed.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{(d.created_at || '').slice(0, 10)}</td>
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

// ── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');

  const load = () => api.adminUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const toggleActive = async (u) => {
    setError(''); setMsg('');
    try { await api.updateUser(u.id, { is_active: u.is_active ? 0 : 1 }); setMsg(`${u.email} ${u.is_active ? 'deactivated' : 'activated'}.`); load(); }
    catch (e) { setError(e.message); }
  };

  const remove = async (u) => {
    if (!confirm(`Delete user "${u.email}"? This cannot be undone.`)) return;
    setError(''); setMsg('');
    try { await api.deleteUser(u.id); setMsg(`${u.email} deleted.`); load(); }
    catch (e) { setError(e.message); }
  };

  const sl = search.toLowerCase();
  const displayed = users
    .filter((u) => !sl || u.email.toLowerCase().includes(sl) || (u.full_name || '').toLowerCase().includes(sl))
    .filter((u) => !filterRole || u.role === filterRole)
    .filter((u) => {
      if (filterActive === 'active') return u.is_active;
      if (filterActive === 'inactive') return !u.is_active;
      return true;
    });

  const hasFilter = search || filterRole || filterActive;

  return (
    <div className="card">
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        User accounts
        <button className="btn sm" onClick={() => setShowAdd(true)}>Create user</button>
      </h2>
      {error && <div className="error" style={{ margin: '0 18px 12px' }}>{error}</div>}
      {msg && <div style={{ color: 'var(--ok)', padding: '0 18px 8px', fontSize: 14 }}>{msg}</div>}
      <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 12 }}>
        <input placeholder="Search email or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
          <option value="">Active &amp; Inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        {hasFilter && <button className="reset" onClick={() => { setSearch(''); setFilterRole(''); setFilterActive(''); }}>Clear</button>}
      </div>
      {displayed.length === 0
        ? <div className="empty">{hasFilter ? 'No users match these filters.' : 'No users found.'}</div>
        : (
          <>
            {hasFilter && <div className="results-count">{displayed.length} of {users.length} users</div>}
            <div className="table-scroll">
              <table>
                <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {displayed.map((u) => (
                    <Fragment key={u.id}>
                      <tr>
                        <td>{u.email}</td>
                        <td>{u.full_name || '—'}</td>
                        <td><span className="tag approved" style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</span></td>
                        <td><span className={`tag ${u.is_active ? 'approved' : 'rejected'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div className="actions">
                            <button className="btn ghost sm" onClick={() => setEditUser(u)}>Edit</button>
                            <button className="btn ghost sm" onClick={() => toggleActive(u)}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn no sm" onClick={() => remove(u)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      <tr className="perm-row">
                        <td colSpan="5">
                          <div className="perm-chips">
                            {(ROLE_PERMS[u.role] || []).map((p) => (
                              <span key={p} className={`perm-tag${p === '*' ? ' perm-full' : ''}`}>
                                {PERM_LABELS[p] || p}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      {showAdd && <CreateUserModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); load(); }} />}
    </div>
  );
}

// ── Teams ─────────────────────────────────────────────────────────────────────
function Teams() {
  const [managers, setManagers] = useState([]);
  const [teamTarget, setTeamTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = () => api.teamManagers().then(setManagers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const sl = search.toLowerCase();
  const displayed = managers.filter((m) =>
    !sl || m.full_name.toLowerCase().includes(sl) ||
    (m.department_name || '').toLowerCase().includes(sl)
  );

  return (
    <div className="card">
      <h2>Team Structure</h2>
      {error && <div className="error" style={{ margin: '0 18px 12px' }}>{error}</div>}
      {managers.length === 0 ? (
        <div className="empty">
          No managers found. Create users with the "manager" role in the Users tab, then link them to an employee profile.
        </div>
      ) : (
        <>
          <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 12 }}>
            <input placeholder="Search managers…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="reset" onClick={() => setSearch('')}>Clear</button>}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Manager</th><th>Department</th><th>Designation</th><th>Team size</th><th></th></tr>
              </thead>
              <tbody>
                {displayed.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.full_name}</td>
                    <td>{m.department_name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{m.designation || '—'}</td>
                    <td>
                      <span className={`tag ${m.team_size > 0 ? 'approved' : 'pending'}`}>
                        {m.team_size} member{m.team_size !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      <button className="btn ghost sm" onClick={() => setTeamTarget(m)}>
                        Manage Team
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {teamTarget && (
        <ManageTeamModal
          manager={teamTarget}
          onClose={() => setTeamTarget(null)}
          onSaved={() => { load(); setTeamTarget(null); }} />
      )}
    </div>
  );
}

function ManageTeamModal({ manager, onClose, onSaved }) {
  const [team, setTeam] = useState([]);
  const [allEmps, setAllEmps] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadTeam = () => api.teamMembers(manager.id).then(setTeam).catch(() => {});
  useEffect(() => {
    loadTeam();
    api.employees('').then(setAllEmps).catch(() => {});
  }, []);

  const assign = async (empId) => {
    setError('');
    try { await api.assignManager(empId, manager.id); loadTeam(); }
    catch (e) { setError(e.message); }
  };

  const unassign = async (empId) => {
    setError('');
    try { await api.assignManager(empId, null); loadTeam(); }
    catch (e) { setError(e.message); }
  };

  const teamIds = new Set(team.map((e) => e.id));
  // Exclude the manager themselves from being added to their own team
  const available = allEmps.filter((e) => !teamIds.has(e.id) && e.id !== manager.id);
  const sl = search.toLowerCase();
  const filtered = available.filter((e) =>
    !sl || e.full_name.toLowerCase().includes(sl) ||
    (e.designation || '').toLowerCase().includes(sl) ||
    (e.department_name || '').toLowerCase().includes(sl)
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 700 }} onClick={(e) => e.stopPropagation()}>
        <h3>Manage Team — {manager.full_name}</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="two-col">
            {/* Current team */}
            <div>
              <p className="col-head">Current team ({team.length})</p>
              <div className="scroll-list">
                {team.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>No team members yet.</div>
                ) : (
                  team.map((e) => (
                    <div className="team-row" key={e.id}>
                      <div>
                        <div className="name">{e.full_name}</div>
                        <div className="sub">{e.designation || e.department_name || '—'}</div>
                      </div>
                      <button className="btn no sm" onClick={() => unassign(e.id)}>Remove</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available employees */}
            <div>
              <p className="col-head">Add to team</p>
              <input placeholder="Search employees…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, marginBottom: 8 }} />
              <div className="scroll-list">
                {filtered.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {search ? 'No employees match.' : 'All employees are already assigned.'}
                  </div>
                ) : (
                  filtered.map((e) => (
                    <div className="team-row" key={e.id}>
                      <div>
                        <div className="name">{e.full_name}</div>
                        <div className="sub">
                          {e.designation || '—'}
                          {e.manager_name && <span style={{ color: 'var(--warn)' }}> · currently under {e.manager_name}</span>}
                        </div>
                      </div>
                      <button className="btn sm" onClick={() => assign(e.id)}>Add</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <button className="btn" onClick={onSaved}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Create / Edit user modals ─────────────────────────────────────────────────
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
