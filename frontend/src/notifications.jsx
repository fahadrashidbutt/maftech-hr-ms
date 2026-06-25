// src/notifications.jsx
// Polls /api/notifications every 15 s, shows toasts for new items, plays a sound,
// and fires a browser (OS-level) notification when the tab is not visible.
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, token } from './api.js';

const NotifCtx = createContext({ unreadCount: 0, refresh: () => {} });

// ── audio ─────────────────────────────────────────────────────────────────────
// A single shared AudioContext; browsers suspend it until a user gesture occurs.
let _ac = null;
function getAc() {
  if (!_ac || _ac.state === 'closed') {
    _ac = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ac;
}

// Unlock the AudioContext on the first click or keypress so subsequent sounds play.
if (typeof window !== 'undefined') {
  const unlock = () => { try { const ac = getAc(); if (ac.state === 'suspended') ac.resume(); } catch {} };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

function playDing() {
  try {
    const ac = getAc();
    const go = () => {
      // Two-tone ding: A5 then C#6, gentle volume
      [[880, 0, 0.13], [1108, 0.17, 0.22]].forEach(([freq, delay, dur]) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        const t = ac.currentTime;
        g.gain.setValueAtTime(0.001, t + delay);
        g.gain.linearRampToValueAtTime(0.18, t + delay + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t + delay);
        o.stop(t + delay + dur + 0.05);
      });
    };
    if (ac.state === 'suspended') ac.resume().then(go);
    else go();
  } catch {}
}

// ── browser (OS) notifications ────────────────────────────────────────────────
function requestBrowserPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Only fire the OS notification when the user isn't looking at the tab;
// the in-app toast already handles the visible case.
function pushBrowserNotif(title, body) {
  if (
    'Notification' in window &&
    Notification.permission === 'granted' &&
    document.visibilityState !== 'visible'
  ) {
    const n = new Notification(title, { body, icon: '/logo-color.svg' });
    setTimeout(() => n.close(), 8000);
  }
}

// ── provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const seenIds = useRef(new Set());
  const isFirst = useRef(true);

  useEffect(() => { requestBrowserPermission(); }, []);

  const dismiss = useCallback((tid) => setToasts((p) => p.filter((t) => t.tid !== tid)), []);

  const addToast = useCallback((n) => {
    const tid = `${n.id}-${Date.now()}`;
    setToasts((p) => [...p.slice(-4), { tid, title: n.title, body: n.body }]);
    setTimeout(() => dismiss(tid), 6000);
    playDing();
    pushBrowserNotif(n.title, n.body);
  }, [dismiss]);

  const refresh = useCallback(async () => {
    if (!token.get()) return;
    try {
      const ns = await api.notifications();
      const unread = ns.filter((n) => !n.is_read);
      setUnreadCount(unread.length);
      if (!isFirst.current) {
        unread.forEach((n) => { if (!seenIds.current.has(n.id)) addToast(n); });
      }
      ns.forEach((n) => seenIds.current.add(n.id));
      isFirst.current = false;
    } catch { /* network errors are silent */ }
  }, [addToast]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <NotifCtx.Provider value={{ unreadCount, refresh }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-wrap">
          {toasts.map((t) => (
            <div key={t.tid} className="toast">
              <div className="toast-head">
                <span>{t.title}</span>
                <button onClick={() => dismiss(t.tid)}>&#x2715;</button>
              </div>
              {t.body && <div className="toast-body">{t.body}</div>}
            </div>
          ))}
        </div>
      )}
    </NotifCtx.Provider>
  );
}

export const useNotifications = () => useContext(NotifCtx);
