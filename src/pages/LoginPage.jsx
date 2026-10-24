import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
  const { login, isLoggedIn, sessionLoading } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // If already authenticated, redirect directly to dashboard
  if (!sessionLoading && isLoggedIn) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Incorrect Login ID / email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🚦 ITS</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in with your Login ID or Email to continue.</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>Email or Login ID</label>
          <input
            type="text"
            placeholder="you@example.com or username"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            autoComplete="username"
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
