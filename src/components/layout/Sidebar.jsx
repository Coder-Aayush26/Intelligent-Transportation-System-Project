import { NavLink } from 'react-router-dom';
import { 
  Map, FileText, MapPin, Bell, Star, BarChart2, PlusCircle, 
  User, Settings, LogOut, Menu
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/app/dashboard', icon: Map, label: 'Live Map' },
  { to: '/app/reports', icon: FileText, label: 'My Reports' },
  { to: '/app/nearby', icon: MapPin, label: 'Nearby Incidents' },
  { to: '/app/notifications', icon: Bell, label: 'Notifications', badge: 3 },
  { to: '/app/favorites', icon: Star, label: 'Favorites' },
  { to: '/app/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/app/report', icon: PlusCircle, label: 'Report Incident' },
  { to: '/app/profile', icon: User, label: 'Profile' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="sb-logo">ITS</div>
        <button className="sb-menu" aria-label="Collapse sidebar">
          <Menu size={20} />
        </button>
      </div>

      <nav aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <Icon size={18} className="ic" aria-hidden="true" />
              {item.label}
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <NavLink to="/" className="nav-item">
          <LogOut size={18} className="ic" aria-hidden="true" />
          Logout
        </NavLink>
      </div>
    </aside>
  );
}
