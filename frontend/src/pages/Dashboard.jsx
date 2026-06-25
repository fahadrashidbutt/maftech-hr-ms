// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Employees have no dashboard — send them to their profile area.
  useEffect(() => { if (!can('dashboard.hr')) nav('/employees', { replace: true }); }, []);

  useEffect(() => {
    if (!can('dashboard.hr')) return;
    api.dashboard().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (!can('dashboard.hr')) return null;
  if (error) return <div className="error">{error}</div>;
  if (!stats) return <div className="empty">Loading dashboard…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>HR Dashboard</h1>
          <p>An overview of your workforce at a glance.</p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Total employees" value={stats.total_employees} />
        <Stat label="New joiners (30 days)" value={stats.new_joiners} />
        <Stat label="On leave today" value={stats.on_leave_today} amber />
        <Stat label="Pending leave requests" value={stats.pending_leave_requests} amber />
      </div>

      <div className="card">
        <h2>Upcoming terminations (next 30 days)</h2>
        {stats.upcoming_terminations.length === 0
          ? <div className="empty">No upcoming terminations.</div>
          : (
            <table>
              <thead><tr><th>Employee</th><th>Date of Termination</th></tr></thead>
              <tbody>
                {stats.upcoming_terminations.map((e) => (
                  <tr key={e.id} className="row-link" onClick={() => nav(`/employees/${e.id}`)}>
                    <td>{e.full_name}</td><td>{e.date_of_termination}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </>
  );
}

function Stat({ label, value, amber }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${amber ? 'amber' : ''}`}>{value}</div>
    </div>
  );
}
