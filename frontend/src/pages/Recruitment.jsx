// src/pages/Recruitment.jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'hired', 'rejected'];
const JOB_STATUSES = ['open', 'closed'];

const statusLabel = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const statusClass = (s) => s === 'hired' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending';

export default function Recruitment() {
  const { can } = useAuth();
  const write = can('*') || can('recruitment.write');
  const [jobs, setJobs] = useState([]);
  const [active, setActive] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [viewAll, setViewAll] = useState(false);
  const [error, setError] = useState('');
  const [showJob, setShowJob] = useState(false);
  const [showCand, setShowCand] = useState(false);

  // job filters
  const [filterJobStatus, setFilterJobStatus] = useState('');
  const [filterJobDept, setFilterJobDept] = useState('');
  const [jobSearch, setJobSearch] = useState('');

  // candidate filters
  const [filterCandStatus, setFilterCandStatus] = useState('');
  const [candSearch, setCandSearch] = useState('');

  const loadJobs = () => api.jobs().then((j) => {
    setJobs(j);
    if (!active && j.length) setActive(j[0]);
  }).catch((e) => setError(e.message));

  const loadCands = (jobId) =>
    api.candidates(jobId).then(setCandidates).catch(() => setCandidates([]));

  useEffect(() => { loadJobs(); }, []);
  useEffect(() => {
    if (viewAll) loadCands(null);
    else if (active) loadCands(active.id);
  }, [active, viewAll]);

  const setStatus = async (id, status) => {
    try {
      await api.updateCandidate(id, { status });
      viewAll ? loadCands(null) : loadCands(active?.id);
    } catch (e) { setError(e.message); }
  };

  // collect dept names from jobs for dept filter
  const deptOptions = [...new Set(jobs.map((j) => j.department_name).filter(Boolean))];

  const jsl = jobSearch.toLowerCase();
  const filteredJobs = jobs
    .filter((j) => !filterJobStatus || j.status === filterJobStatus)
    .filter((j) => !filterJobDept || (j.department_name || '') === filterJobDept)
    .filter((j) => !jsl || j.title.toLowerCase().includes(jsl));

  const csl = candSearch.toLowerCase();
  const filteredCands = candidates
    .filter((c) => !filterCandStatus || c.status === filterCandStatus)
    .filter((c) => !csl || c.full_name.toLowerCase().includes(csl) ||
      (c.email || '').toLowerCase().includes(csl) ||
      (c.job_title || '').toLowerCase().includes(csl));

  const hasJobFilter = filterJobStatus || filterJobDept || jobSearch;
  const hasCandFilter = filterCandStatus || candSearch;

  return (
    <>
      <div className="page-head">
        <div><h1>Recruitment</h1><p>Track job openings and candidates.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => setShowCand(true)}>Add candidate</button>
          {write && <button className="btn" onClick={() => setShowJob(true)}>New opening</button>}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Job openings</h2>
        <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 12 }}>
          <input placeholder="Search job title…" value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)} />
          <select value={filterJobStatus} onChange={(e) => setFilterJobStatus(e.target.value)}>
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          {deptOptions.length > 0 && (
            <select value={filterJobDept} onChange={(e) => setFilterJobDept(e.target.value)}>
              <option value="">All departments</option>
              {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {hasJobFilter && (
            <button className="reset" onClick={() => { setFilterJobStatus(''); setFilterJobDept(''); setJobSearch(''); }}>
              Clear
            </button>
          )}
        </div>
        {filteredJobs.length === 0 ? <div className="empty">{hasJobFilter ? 'No job openings match these filters.' : 'No job openings yet.'}</div> : (
          <>
            {hasJobFilter && <div className="results-count">{filteredJobs.length} of {jobs.length} openings</div>}
            <table>
              <thead><tr><th>Title</th><th>Department</th><th>Shift</th><th>Salary (PKR)</th><th>Candidates</th><th>Status</th></tr></thead>
              <tbody>
                {filteredJobs.map((j) => (
                  <tr key={j.id} className="row-link"
                    onClick={() => { setActive(j); setViewAll(false); setFilterCandStatus(''); setCandSearch(''); }}
                    style={!viewAll && active?.id === j.id ? { background: 'var(--teal-050)' } : null}>
                    <td><strong>{j.title}</strong></td>
                    <td>{j.department_name || '—'}</td>
                    <td>{j.shift || '—'}</td>
                    <td>{j.salary ? Number(j.salary).toLocaleString() : '—'}</td>
                    <td>{j.candidate_count}</td>
                    <td><span className={`tag ${j.status}`}>{j.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {viewAll ? 'All candidates' : active ? `Candidates — ${active.title}` : 'Candidates'}
          </span>
          <button className="btn ghost sm" onClick={() => { setViewAll(!viewAll); setFilterCandStatus(''); setCandSearch(''); }}>
            {viewAll ? 'Filter by job' : 'View all'}
          </button>
        </h2>
        <div className="filter-bar" style={{ padding: '0 18px', marginBottom: 12 }}>
          <input placeholder="Search name, email, job…" value={candSearch}
            onChange={(e) => setCandSearch(e.target.value)} />
          <select value={filterCandStatus} onChange={(e) => setFilterCandStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {hasCandFilter && (
            <button className="reset" onClick={() => { setFilterCandStatus(''); setCandSearch(''); }}>
              Clear
            </button>
          )}
        </div>
        {filteredCands.length === 0 ? <div className="empty">{hasCandFilter ? 'No candidates match these filters.' : 'No candidates found.'}</div> : (
          <>
            {hasCandFilter && <div className="results-count">{filteredCands.length} of {candidates.length} candidates</div>}
            <table>
              <thead><tr>
                <th>Name</th><th>Job opening</th><th>Contact</th><th>Resume</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filteredCands.map((c) => (
                  <tr key={c.id}>
                    <td>{c.full_name}</td>
                    <td style={{ fontSize: 13, color: 'var(--muted)' }}>{c.job_title}</td>
                    <td>{c.email || '—'}</td>
                    <td>
                      {c.resume_stored
                        ? <a className="btn ghost sm" href={`/api/recruitment/candidates/${c.id}/resume`}>Download</a>
                        : '—'}
                    </td>
                    <td>
                      {write ? (
                        <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)}
                          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13 }}>
                          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      ) : (
                        <span className={`tag ${statusClass(c.status)}`}>{statusLabel(c.status)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showJob && <JobForm onClose={() => setShowJob(false)} onSaved={() => { setShowJob(false); loadJobs(); }} />}
      {showCand && (
        <CandForm jobId={active?.id} jobs={jobs} onClose={() => setShowCand(false)}
          onSaved={() => {
            setShowCand(false);
            viewAll ? loadCands(null) : active && loadCands(active.id);
            loadJobs();
          }} />
      )}
    </>
  );
}

function JobForm({ onClose, onSaved }) {
  const [f, setF] = useState({ title: '', department_id: '', description: '', shift: '', salary: '' });
  const [depts, setDepts] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    api.departments().then(setDepts).catch(() => {});
    api.shifts().then(setShifts).catch(() => {});
  }, []);
  const save = async () => {
    setError('');
    try {
      await api.createJob({ ...f, department_id: f.department_id || null, salary: f.salary ? Number(f.salary) : null });
      onSaved();
    } catch (e) { setError(e.message); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New job opening</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Title *</label><input value={f.title} onChange={set('title')} /></div>
          <div className="grid-2">
            <div className="field"><label>Department</label>
              <select value={f.department_id} onChange={set('department_id')}>
                <option value="">—</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Shift</label>
              <select value={f.shift} onChange={set('shift')}>
                <option value="">—</option>
                {shifts.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Salary (PKR)</label>
              <input type="number" value={f.salary} onChange={set('salary')} placeholder="e.g. 150000" />
            </div>
          </div>
          <div className="field"><label>Description</label>
            <textarea rows="3" value={f.description} onChange={set('description')} />
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Create opening</button>
        </div>
      </div>
    </div>
  );
}

function CandForm({ jobId, jobs, onClose, onSaved }) {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', status: 'applied' });
  const [selectedJob, setSelectedJob] = useState(String(jobId || ''));
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setError('');
    if (!f.full_name) return setError('Candidate name is required.');
    if (!selectedJob) return setError('Please select a job opening.');
    const form = new FormData();
    form.append('job_id', selectedJob);
    form.append('full_name', f.full_name);
    form.append('email', f.email);
    form.append('phone', f.phone);
    form.append('status', f.status);
    if (resume) form.append('resume', resume);
    try { await api.createCandidate(form); onSaved(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add candidate</h3>
        <div className="body">
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Job opening *</label>
            <select value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
              <option value="">— Select a job opening —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}{j.department_name ? ` (${j.department_name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Full name *</label>
            <input value={f.full_name} onChange={set('full_name')} />
          </div>
          <div className="grid-2">
            <div className="field"><label>Email</label><input value={f.email} onChange={set('email')} /></div>
            <div className="field"><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
          </div>
          <div className="grid-2">
            <div className="field"><label>Initial status</label>
              <select value={f.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div className="field"><label>Resume (optional)</label>
              <input type="file" onChange={(e) => setResume(e.target.files[0])} />
            </div>
          </div>
        </div>
        <div className="foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save}>Add candidate</button>
        </div>
      </div>
    </div>
  );
}
