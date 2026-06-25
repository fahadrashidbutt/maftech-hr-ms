// src/pages/Notifications.jsx
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useNotifications } from '../notifications.jsx';

export default function Notifications() {
  const { can } = useAuth();
  const { refresh: refreshBadge } = useNotifications();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api.notifications().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try { await api.markRead(id); load(); refreshBadge(); } catch (e) { setError(e.message); }
  };
  const generate = async () => {
    setMsg('');
    try { const r = await api.generateNotifications(); setMsg(`${r.created} new notification(s) generated.`); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Notifications</h1><p>Onboarding, leave decisions, birthdays, probation, contract and document expiry.</p></div>
        {can('dashboard.hr') && <button className="btn ghost" onClick={generate}>Check for events</button>}
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="card"><div className="body" style={{ paddingTop: 14, color: 'var(--ok)' }}>{msg}</div></div>}

      <div className="card">
        {rows.length === 0 ? <div className="empty">You're all caught up.</div> : rows.map((n) => (
          <div key={n.id} className={`notif ${n.is_read ? 'read' : 'unread'}`}
            onClick={() => !n.is_read && markRead(n.id)}
            style={{ cursor: n.is_read ? 'default' : 'pointer' }}>
            <div className="dot" />
            <div>
              <div className="t">{n.title}</div>
              <div className="b">{n.body}</div>
            </div>
            <div className="time">{(n.created_at || '').replace('T', ' ').slice(0, 16)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
