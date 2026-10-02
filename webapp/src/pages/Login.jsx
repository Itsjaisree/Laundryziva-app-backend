import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import supportBg from '../assets/bg_support.webp';
import superBg from '../assets/bg_super.webp';

// One login page for both areas. The role decides which account may use it.
export default function Login({ role, base }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSuper = role === 'super_admin';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password, role);
      navigate(`${base}/${isSuper ? 'overview' : 'work'}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${isSuper ? superBg : supportBg})` }}>
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark brand-mark-lg">Lz</div>
        <h1>{isSuper ? 'Super admin' : 'Customer support'}</h1>
        <p className="muted">Sign in to continue</p>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
