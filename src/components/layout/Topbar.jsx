import { useNavigate } from 'react-router-dom';
import './Topbar.css';

export default function Topbar({ title = 'Search location…' }) {
  const navigate = useNavigate();

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
          <span className="icon-btn-badge">3</span>
        </button>
        <button className="user-chip" onClick={() => navigate('/app/profile')}>
          <span className="avatar" aria-hidden="true">👤</span>
          <span className="n">Aayush</span>
          <span className="chevron">▾</span>
        </button>
      </div>
    </header>
  );
}
