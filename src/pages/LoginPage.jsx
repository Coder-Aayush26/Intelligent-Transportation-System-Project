import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

  async function handleDemoLogin() {
    setError('');
    setLoading(true);
    try {
      await login('Demo User', 'demo123');
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in with demo user.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="auth-back-btn" title="Back to Home">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          <Link to="/" className="auth-logo-link" title="ITS Home">
            <span className="auth-logo">🚦 ITS</span>
          </Link>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in with your Login ID or Email to continue.</p>

        {error && (
          <div className="auth-error" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span>⚠ {error}</span>
            {error.includes('Server Error') && (
              <button
                type="button"
                onClick={handleDemoLogin}
                style={{
                  background: 'none',
                  border: '1px solid currentColor',
                  color: 'inherit',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  alignSelf: 'flex-start',
                }}
              >
                ⚡ Sign in with Demo Account instead
              </button>
            )}
          </div>
        )}

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

          <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0 8px', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border, #dde3f0)' }}></div>
            <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or test instantly</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border, #dde3f0)' }}></div>
          </div>

          <button 
            type="button" 
            className="auth-btn" 
            style={{ 
              background: 'linear-gradient(135deg, #10b981, #059669)', 
              marginTop: 0,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' 
            }}
            onClick={handleDemoLogin}
            disabled={loading}
          >
            ⚡ One-Click Demo Sign In
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
