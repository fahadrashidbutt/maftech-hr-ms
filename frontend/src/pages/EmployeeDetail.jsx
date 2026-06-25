// src/pages/EmployeeDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const EMP_STATUSES = ['active', 'probation', 'on_leave', 'terminated', 'resigned'];

export default function EmployeeDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [emp, setEmp] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = () => api.employee(id).then(setEmp).catch((e) => setError(e.message));
  const loadDocs = () => api.documents(id).then(setDocs).catch(() => setDocs([]));

  useEffect(() => { load(); loadDocs(); }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!emp) return <div className="empty">Loading…</div>;

  const Field = ({ label, value }) => (
    <div className="field"><label>{label}</label><div>{value || '—'}</div></div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{emp.full_name}</h1>
          <p>{emp.designation || 'No designation'} · {emp.department_name || 'No department'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('employee.edit') && (
            <button className="btn" onClick={() => setShowEdit(true)}>Edit profile</button>
          )}
          <button className="btn ghost" onClick={() => nav(-1)}>← Back</button>
        </div>
      </div>

      <div className="card">
        <h2>Profile</h2>
        <div className="body">
          <div className="grid-2">
            <Field label="Employee code" value={emp.employee_code} />
            <Field label="Email" value={emp.email} />
            <Field label="Phone" value={emp.phone} />
            <Field label="CNIC" value={emp.cnic} />
            <Field label="Date of birth" value={emp.date_of_birth} />
            <Field label="Gender" value={emp.gender} />
            <Field label="Marital status" value={emp.marital_status} />
            <Field label="Address" value={emp.address} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Employment</h2>
        <div className="body">
          <div className="grid-2">
            <Field label="Manager" value={emp.manager_name} />
            <Field label="Date of joining" value={emp.date_of_joining} />
            <Field label="Probation ends" value={emp.probation_end} />
            <div className="field">
              <label>Employment status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="tag approved">{emp.employment_status}</span>
                {can('employee.edit') && (
                  <StatusDropdown empId={emp.id} current={emp.employment_status} onChanged={load} />
                )}
              </div>
            </div>
            <Field label="Shift" value={emp.shift} />
            <Field label="Salary (PKR)" value={emp.salary ? Number(emp.salary).toLocaleString() : null} />
            <Field label="Date of termination" value={emp.date_of_termination} />
            <Field label="Reason of termination" value={emp.termination_reason} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Banking &amp; Emergency</h2>
        <div className="body">
          <div className="grid-2">
            <Field label="Bank name" value={emp.bank_name} />
            <Field label="IBAN" value={emp.iban} />
            <Field label="Emergency contact" value={emp.emergency_name} />
            <Field label="Relation" value={emp.emergency_relation} />
            <Field label="Emergency phone" value={emp.emergency_phone} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Documents
          {can('document.write') &&
            <button className="btn sm" onClick={() => setShowUpload(true)}>Upload</button>}
        </h2>
        {docs.length === 0 ? <div className="empty">No documents on file yet.</div> : (
          <table>
            <thead><tr><th>Type</th><th>File</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>{d.doc_type}</td>
                  <td>{d.file_name}</td>
                  <td>{d.expires_on || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <a className="btn ghost sm" href={api.downloadDocUrl(d.id)}>Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && (
        <UploadDoc employeeId={id} onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); loadDocs(); }} />
      )}
      {showEdit && (
        <EditEmployee emp={emp} onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }} />
      )}
    </>
  );
}

function StatusDropdown({ empId, current, onChanged }) {
  const [changing, setChanging] = useState(false);
  const change = async (status) => {
    if (status === current) return;
    setChanging(true);
    try { await api.changeEmployeeStatus(empId, status); onChanged(); }
    catch { /* error shown elsewhere */ }
    finally { setChanging(false); }
  };
  return (
    <select value={current} onChange={(e) => change(e.target.value)} disabled={changing}
      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13 }}>
      {EMP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function EditEmployee({ emp, onClose, onSaved }) {
  const [f, setF] = useState({
    employee_code: emp.employee_code || '',
    full_name: emp.full_name || '',
    cnic: emp.cnic || '',
    date_of_birth: emp.date_of_birth || '',
    gender: emp.gender || '',
    marital_status: emp.marital_status || '',
    address: emp.address || '',
    phone: emp.phone || '',
    email: emp.email || '',
    department_id: emp.department_id || '',
    designation: emp.designation || '',
    manager_id: emp.manager_id || '',
    date_of_joining: emp.date_of_joining || '',
    employment_status: emp.employment_status || 'active',
    probation_end: emp.probation_end || '',
    date_of_termination: emp.date_of_termination || '',
    termination_reason: emp.termination_reason || '',
    shift: emp.shift || '',
    salary: emp.salary || '',
    bank_name: emp.bank_name || '',
    iban: emp.iban || '',
    emergency_name: emp.emergency_name || '',
    emergency_relation: emp.emergency_relation || '',
    emergency_phone: emp.emergency_phone || '',
  });
  const [depts, setDepts] = useState([]);
  const [managers, setManagers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.departments().then(setDepts).catch(() => {});
    api.managers().then(setManagers).catch(() => {});
    api.shifts().then(setShifts).catch(() => {});
  }, []);

  const save = async () => {
    setError('');
    try {
      await api.updateEmployee(emp.id, {
        ...f,
        department_id: f.department_id || null,
        manager_id: f.manager_id || null,
        salary: f.salary ? Number(f.salary) : null,
      });
      onSaved();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <h3>Edit employee — {emp.full_name}</h3>
        <div className="body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div className="error">{error}</div>}

          <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-2)', fontSize: 13 }}>PERSONAL</p>
          <div className="field"><label>Full name *</label><input value={f.full_name} onChange={set('full_name')} /></div>
          <div className="grid-2">
            <div className="field"><label>Employee code</label><input value={f.employee_code} onChange={set('employee_code')} /></div>
            <div className="field"><label>CNIC</label><input value={f.cnic} onChange={set('cnic')} /></div>
            <div className="field"><label>Date of birth</label><input type="date" value={f.date_of_birth} onChange={set('date_of_birth')} /></div>
            <div className="field"><label>Gender</label>
              <select value={f.gender} onChange={set('gender')}>
                <option value="">—</option>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="field"><label>Marital status</label>
              <select value={f.marital_status} onChange={set('marital_status')}>
                <option value="">—</option>
                <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
              </select>
            </div>
            <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} /></div>
          </div>
          <div className="field"><label>Address</label><textarea rows="2" value={f.address} onChange={set('address')} /></div>

          <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, color: 'var(--text-2)', fontSize: 13 }}>EMPLOYMENT</p>
          <div className="grid-2">
            <div className="field"><label>Designation</label><input value={f.designation} onChange={set('designation')} /></div>
            <div className="field"><label>Department</label>
              <select value={f.department_id} onChange={set('department_id')}>
                <option value="">—</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Manager</label>
              <select value={f.manager_id} onChange={set('manager_id')}>
                <option value="">—</option>
                {managers.filter(m => m.id !== emp.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Date of joining</label><input type="date" value={f.date_of_joining} onChange={set('date_of_joining')} /></div>
            <div className="field"><label>Probation end</label><input type="date" value={f.probation_end} onChange={set('probation_end')} /></div>
            <div className="field"><label>Employment status</label>
              <select value={f.employment_status} onChange={set('employment_status')}>
                {EMP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Shift</label>
              <select value={f.shift} onChange={set('shift')}>
                <option value="">—</option>
                {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Salary (PKR)</label><input type="number" value={f.salary} onChange={set('salary')} /></div>
            <div className="field"><label>Date of termination</label><input type="date" value={f.date_of_termination} onChange={set('date_of_termination')} /></div>
          </div>
          <div className="field"><label>Reason of termination</label><textarea rows="2" value={f.termination_reason} onChange={set('termination_reason')} /></div>

          <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, color: 'var(--text-2)', fontSize: 13 }}>BANKING</p>
          <div className="grid-2">
            <div className="field"><label>Bank name</label><input value={f.bank_name} onChange={set('bank_name')} /></div>
            <div className="field"><label>IBAN</label><input value={f.iban} onChange={set('iban')} /></div>
          </div>

          <p style={{ fontWeight: 600, marginBottom: 8, marginTop: 16, color: 'var(--text-2)', fontSize: 13 }}>EMERGENCY CONTACT</p>
          <div className="grid-2">
            <div className="field"><label>Name</label><input value={f.emergency_name} onChange={set('emergency_name')} /></div>
            <div className="field"><label>Relation</label><input value={f.emergency_relation} onChange={set('emergency_relation')} /></div>
            <div className="field"><label>Phone</label><input value={f.emergency_phone} onChange={set('emergency_phone')} /></div>
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

function UploadDoc({ employeeId, onClose, onSaved }) {
  const [types, setTypes] = useState([]);
  const [docType, setDocType] = useState('');
  const [expires, setExpires] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.docTypes().then((t) => { setTypes(t); setDocType(t[0]); }).catch(() => {}); }, []);

  const save = async () => {
    setError('');
    if (!file) return setError('Choose a file to upload.');
    const form = new FormData();
    form.append('file', file);
    form.append('employee_id', employeeId);
    form.append('doc_type', docType);
    if (expires) form.append('expires_on', expires);
    try { await api.uploadDocument(form); onSaved(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Upload document</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field"><label>Expiry date (optional)</label>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
          <div className="field"><label>File</label>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} /></div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Upload</button>
        </div>
      </div>
    </div>
  );
}
