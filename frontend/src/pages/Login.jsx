// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('hr@maftech.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) { nav('/', { replace: true }); }

  const submit = async () => {
    setError(''); setBusy(true);
    try { await login(email, password); nav('/', { replace: true }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand" style={{ textAlign: 'center' }}>
          <img src="/logo-color.svg" alt="Maftech" style={{ height: 42, display: 'block', margin: '0 auto 8px' }} />
          HR<span style={{ color: 'var(--amber)' }}> MS</span>
        </div>
        <div className="sub">Sign in to your workspace</div>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="demo">
          Demo accounts — password <code>password123</code>:<br />
          <code>admin@maftech.com</code> · Super Admin<br />
          <code>hr@maftech.com</code> · HR<br />
          <code>manager@maftech.com</code> · Manager<br />
          <code>employee@maftech.com</code> · Employee
        </div>
      </div>
    </div>
  );
}
