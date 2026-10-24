import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Settings, MapPin, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchNotifications } from '../../api/incidents';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import './Topbar.css';

export default function Topbar({ title = 'Search location…' }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notifCount, setNotifCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setNotifCount(0));
  }, []);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    setIsDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.fullName || user?.name || 'User';

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
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/app/dashboard')}>
        ☰ Filters
      </button>

      <div className="topbar-right">
        <button
          className="icon-btn"
          aria-label="Notifications"
          onClick={() => navigate('/app/notifications')}
        >
          🔔
          {notifCount > 0 && <span className="icon-btn-badge">{notifCount}</span>}
        </button>

        {/* User Dropdown */}
        <div className="user-dropdown-container" ref={dropdownRef}>
          <button
            className={`user-chip ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
            aria-label="User navigation menu"
          >
            <UserAvatar user={user} size="sm" />
            <span className="n">{displayName}</span>
            <ChevronDown size={14} className={`chevron-icon ${isDropdownOpen ? 'open' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="user-dropdown-menu" role="menu">
              <div className="dropdown-user-header">
                <UserAvatar user={user} size="md" />
                <div className="dropdown-user-info">
                  <div className="dropdown-user-name">{displayName}</div>
                  <div className="dropdown-user-email">{user?.email || 'Authenticated User'}</div>
                </div>
              </div>

              <div className="dropdown-divider" />

              <Link
                to="/app/profile"
                className="dropdown-item"
                role="menuitem"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User size={16} className="dropdown-item-icon" />
                <span>My Profile</span>
              </Link>

              <Link
                to="/app/settings"
                className="dropdown-item"
                role="menuitem"
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings size={16} className="dropdown-item-icon" />
                <span>Settings</span>
              </Link>

              <Link
                to="/app/nearby"
                className="dropdown-item"
                role="menuitem"
                onClick={() => setIsDropdownOpen(false)}
              >
                <MapPin size={16} className="dropdown-item-icon" />
                <span>Nearby Incidents</span>
              </Link>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-item logout-item"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsLogoutModalOpen(true);
                }}
              >
                <LogOut size={16} className="dropdown-item-icon" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Confirm Logout"
        message="Are you sure you want to end your current session? You will need to log back in to access protected features."
        confirmText="Log Out"
        isDanger={true}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </header>
  );
}
