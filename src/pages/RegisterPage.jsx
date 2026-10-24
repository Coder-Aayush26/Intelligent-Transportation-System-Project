import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

export default function RegisterPage() {
  const { register, isLoggedIn, sessionLoading } = useAuth();
  const navigate = useNavigate();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // If already authenticated, redirect directly to dashboard
  if (!sessionLoading && isLoggedIn) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🚦 ITS</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start reporting and verifying traffic incidents in your city.</p>

        {error && <div className="auth-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>Full name</label>
          <input
            type="text"
            placeholder="Aayush Praveen"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoComplete="name"
          />

          <label>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <label>Confirm password</label>
          <input
            type="password"
            placeholder="Re-enter password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
