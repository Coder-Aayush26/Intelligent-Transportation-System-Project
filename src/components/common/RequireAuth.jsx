/**
 * RequireAuth — wraps protected routes.
 * Waits for session check to complete, then redirects to /login if not authenticated.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RequireAuth({ children }) {
  const { isLoggedIn, sessionLoading } = useAuth();
  const location = useLocation();

  if (sessionLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontSize: 14 }}>
        Checking session…
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
