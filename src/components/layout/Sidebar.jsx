import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/app/dashboard', icon: '🗺️', label: 'Live Map' },
  { to: '/app/reports', icon: '📄', label: 'My Reports' },
  { to: '/app/nearby', icon: '📍', label: 'Nearby Incidents' },
  { to: '/app/notifications', icon: '🔔', label: 'Notifications', badge: 3 },
  { to: '/app/favorites', icon: '⭐', label: 'Favorites' },
  { to: '/app/analytics', icon: '📊', label: 'Analytics' },
  { to: '/app/report', icon: '➕', label: 'Report Incident' },
  { to: '/app/profile', icon: '👤', label: 'Profile' },
  { to: '/app/settings', icon: '⚙️', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="sb-logo">ITS</div>
        <button className="sb-menu" aria-label="Collapse sidebar">☰</button>
      </div>

      <nav aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
          >
            <span className="ic" aria-hidden="true">{item.icon}</span>
            {item.label}
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <NavLink to="/" className="nav-item">
          <span className="ic" aria-hidden="true">↩</span>
          Logout
        </NavLink>
      </div>
    </aside>
  );
}
