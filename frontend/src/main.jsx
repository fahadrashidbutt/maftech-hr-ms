// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { NotificationProvider, useNotifications } from './notifications.jsx';
import './styles.css';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import EmployeeDetail from './pages/EmployeeDetail.jsx';
import Leave from './pages/Leave.jsx';
import Recruitment from './pages/Recruitment.jsx';
import Notifications from './pages/Notifications.jsx';
import Admin from './pages/Admin.jsx';

function Sidebar() {
  const { user, logout, can } = useAuth();
  const { unreadCount } = useNotifications();
  const showDash = can('dashboard.hr');
  const showRecruit = can('recruitment.read');
  const showAdmin = user.role === 'super_admin' || user.role === 'hr';

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo-white.svg" alt="Maftech" style={{ height: 28, display: 'block', marginBottom: 5 }} />
        HR<span> MS</span>
      </div>
      <nav className="nav">
        {showDash && <NavLink to="/" end>Dashboard</NavLink>}
        <NavLink to="/employees">Employees</NavLink>
        <NavLink to="/leave">Leave</NavLink>
        {showRecruit && <NavLink to="/recruitment">Recruitment</NavLink>}
        <NavLink to="/notifications">
          Notifications
          {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </NavLink>
        {showAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="side-foot">
        <div className="who">{user.name}</div>
        <div className="role">{user.role.replace('_', ' ')}</div>
        <button onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding: 40 }}>Loading&hellip;</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/employees" element={<Protected><Employees /></Protected>} />
      <Route path="/employees/:id" element={<Protected><EmployeeDetail /></Protected>} />
      <Route path="/leave" element={<Protected><Leave /></Protected>} />
      <Route path="/recruitment" element={<Protected><Recruitment /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/admin" element={<Protected><Admin /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
