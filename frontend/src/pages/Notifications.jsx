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

  // filters
  const [filterRead, setFilterRead] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const load = () => api.notifications().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try { await api.markRead(id); load(); refreshBadge(); } catch (e) { setError(e.message); }
  };
  const markAllRead = async () => {
    try {
      const unread = rows.filter((n) => !n.is_read);
      await Promise.all(unread.map((n) => api.markRead(n.id)));
      load(); refreshBadge();
    } catch (e) { setError(e.message); }
  };
  const generate = async () => {
    setMsg('');
    try { const r = await api.generateNotifications(); setMsg(`${r.created} new notification(s) generated.`); load(); }
    catch (e) { setError(e.message); }
  };

  const sl = filterSearch.toLowerCase();
  const displayed = rows
    .filter((n) => {
      if (filterRead === 'unread') return !n.is_read;
      if (filterRead === 'read') return n.is_read;
      return true;
    })
    .filter((n) => !sl || (n.title || '').toLowerCase().includes(sl) || (n.body || '').toLowerCase().includes(sl));

  const hasFilter = filterRead || filterSearch;
  const unreadCount = rows.filter((n) => !n.is_read).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Onboarding, leave decisions, birthdays, probation, contract and document expiry.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button className="btn ghost" onClick={markAllRead}>Mark all read</button>
          )}
          {can('dashboard.hr') && <button className="btn ghost" onClick={generate}>Check for events</button>}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="card"><div className="body" style={{ paddingTop: 14, color: 'var(--ok)' }}>{msg}</div></div>}

      <div className="filter-bar">
        <input placeholder="Search notifications…" value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)} />
        <select value={filterRead} onChange={(e) => setFilterRead(e.target.value)}>
          <option value="">All notifications</option>
          <option value="unread">Unread only</option>
          <option value="read">Read only</option>
        </select>
        {hasFilter && (
          <button className="reset" onClick={() => { setFilterRead(''); setFilterSearch(''); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="card">
        {displayed.length === 0 ? (
          <div className="empty">{hasFilter ? 'No notifications match these filters.' : 'You\'re all caught up.'}</div>
        ) : (
          <>
            {hasFilter && <div className="results-count">{displayed.length} of {rows.length} notifications</div>}
            {displayed.map((n) => (
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
          </>
        )}
      </div>
    </>
  );
}
