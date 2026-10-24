import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNotifications } from '../../api/incidents';
import './Topbar.css';

export default function Topbar({ title = 'Search location…' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setNotifCount(0));
  }, []);

  const displayName = user?.name || user?.fullName || 'User';

  return (
    <header className="topbar">
      <div className="search-box">
        <span aria-hidden="true">🔎</span>
        <input
          type="text"
          className="search-input"
          placeholder={title}
          aria-label="Search location"
        />
      </div>
      <div className="spacer" />
      <button className="btn btn-outline btn-sm">☰ Filters</button>
      <div className="topbar-right">
        <button className="icon-btn" aria-label="Notifications" onClick={() => navigate('/app/notifications')}>
          🔔
          {notifCount > 0 && <span className="icon-btn-badge">{notifCount}</span>}
        </button>
        <button className="user-chip" onClick={() => navigate('/app/profile')}>
          <span className="avatar" aria-hidden="true">👤</span>
          <span className="n">{displayName}</span>
          <span className="chevron">▾</span>
        </button>
      </div>
    </header>
  );
}
