import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Map, FileText, MapPin, Bell, Star, BarChart2, PlusCircle, 
  User, Settings, LogOut, Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchNotifications } from '../../api/incidents';
import ConfirmModal from '../common/ConfirmModal';
import './Sidebar.css';

const BASE_NAV_ITEMS = [
  { to: '/app/dashboard', icon: Map, label: 'Live Map' },
  { to: '/app/reports', icon: FileText, label: 'My Reports' },
  { to: '/app/nearby', icon: MapPin, label: 'Nearby Incidents' },
  { to: '/app/notifications', icon: Bell, label: 'Notifications' },
  { to: '/app/favorites', icon: Star, label: 'Favorites' },
  { to: '/app/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/app/report', icon: PlusCircle, label: 'Report Incident' },
  { to: '/app/profile', icon: User, label: 'Profile' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setNotifCount(0));
  }, []);

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sb-top">
          <div className="sb-logo">ITS</div>
          <button className="sb-menu" aria-label="Collapse sidebar">
            <Menu size={20} />
          </button>
        </div>

        <nav aria-label="Main">
          {BASE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const showBadge = item.label === 'Notifications' && notifCount > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <Icon size={18} className="ic" aria-hidden="true" />
                {item.label}
                {showBadge && <span className="nav-badge">{notifCount}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <button 
            type="button"
            onClick={() => setIsLogoutModalOpen(true)} 
            className="nav-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          >
            <LogOut size={18} className="ic" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Confirm Logout"
        message="Are you sure you want to end your current session? You will need to log back in to access protected features."
        confirmText="Log Out"
        isDanger={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </>
  );
}
