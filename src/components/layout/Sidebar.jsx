import { useState, useEffect, useCallback } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { 
  Map, FileText, MapPin, Bell, Star, BarChart2, PlusCircle, 
  User, Settings, LogOut, Menu, Home, Plus, Navigation, 
  Car, Bike, Briefcase, ChevronRight, X, Edit3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useAppLocation } from '../../context/LocationContext';
import { fetchNotifications } from '../../api/incidents';
import { 
  getFavoriteRoutes, 
  getFavoritePlaces, 
  deleteFavoriteRoute, 
  subscribeFavorites 
} from '../../services/favoritesStorage';
import ConfirmModal from '../common/ConfirmModal';
import AddFavoriteModal from '../common/AddFavoriteModal';
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
  const { connectionStatus, subscribe } = useRealtime();
  const { selectLocation } = useAppLocation();
  const navigate = useNavigate();

  const [notifCount, setNotifCount] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isAddFavoriteOpen, setIsAddFavoriteOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Favorites in sidebar
  const [favoriteRoutes, setFavoriteRoutes] = useState(getFavoriteRoutes);
  const [favoritePlaces, setFavoritePlaces] = useState(getFavoritePlaces);

  const refreshFavorites = useCallback(() => {
    setFavoriteRoutes(getFavoriteRoutes());
    setFavoritePlaces(getFavoritePlaces());
  }, []);

  useEffect(() => {
    const unsub = subscribeFavorites(refreshFavorites);
    return () => unsub();
  }, [refreshFavorites]);

  useEffect(() => {
    let isSubscribed = true;
    const refreshCount = () => {
      fetchNotifications()
        .then((data) => {
          if (isSubscribed) setNotifCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => {
          if (isSubscribed) setNotifCount(0);
        });
    };

    refreshCount();
    // Auto-update notification count on real-time incident broadcasts
    const unsub1 = subscribe('incident_created', refreshCount);
    const unsub2 = subscribe('incident_resolved', refreshCount);
    return () => {
      isSubscribed = false;
      unsub1();
      unsub2();
    };
  }, [subscribe]);

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLaunchRoute = (e, route) => {
    e.preventDefault();
    navigate(`/app/dashboard?route=${encodeURIComponent(route.id)}`);
  };

  const handleEditQuickRoute = (e, route) => {
    e.stopPropagation();
    setItemToEdit(route);
    setIsAddFavoriteOpen(true);
  };

  const handleEditQuickPlace = (e, place) => {
    e.stopPropagation();
    setItemToEdit(place);
    setIsAddFavoriteOpen(true);
  };

  const handleLaunchPlace = (e, place) => {
    e.preventDefault();
    selectLocation({
      lat: place.lat,
      lng: place.lng,
      label: `${place.name} (${place.address})`,
    });
    navigate('/app/dashboard');
  };

  const handleDeleteQuickRoute = (e, routeId) => {
    e.stopPropagation();
    deleteFavoriteRoute(routeId);
  };

  const totalFavs = favoriteRoutes.length + favoritePlaces.length;

  return (
    <>
      <aside className="sidebar">
        <div className="sb-top">
          <Link to="/" className="sb-logo-link" title="Return to Landing Page">
            <div className="sb-logo">ITS</div>
          </Link>
          <button className="sb-menu" aria-label="Collapse sidebar">
            <Menu size={20} />
          </button>
        </div>

        <nav aria-label="Main" className="sb-nav-scroller">
          {/* Direct Home / Landing Page Action */}
          <Link to="/" className="nav-item home-nav-item" title="Return to Home Landing Page">
            <Home size={18} className="ic" aria-hidden="true" />
            <span>Landing Page</span>
          </Link>

          <div className="sb-divider" role="separator" />

          {/* Citizen App Navigation Menu */}
          {BASE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const showBadge = item.label === 'Notifications' && notifCount > 0;
            const showFavBadge = item.label === 'Favorites' && totalFavs > 0;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <Icon size={18} className="ic" aria-hidden="true" />
                {item.label}
                {showBadge && <span className="nav-badge">{notifCount}</span>}
                {showFavBadge && <span className="nav-fav-badge">{totalFavs}</span>}
              </NavLink>
            );
          })}

          <div className="sb-divider" role="separator" />

          {/* ── Enhanced Favourite Section in Sidebar ── */}
          <div className="sb-favorites-section">
            <div className="sb-fav-header-row">
              <div className="sb-fav-title-wrap">
                <Star size={12} className="sb-star-glow" />
                <span className="sb-fav-heading">FAVOURITE ROUTES</span>
              </div>
              <button
                type="button"
                className="sb-add-route-action"
                onClick={() => setIsAddFavoriteOpen(true)}
                title="Add new favorite route or location"
                aria-label="Add favorite route"
              >
                <Plus size={13} />
                <span>Add Route</span>
              </button>
            </div>

            {/* List of Favorite Commute Routes */}
            <div className="sb-fav-items-list">
              {favoriteRoutes.slice(0, 3).map((r) => {
                const RouteIcon = r.mode === 'two-wheeler' ? Bike : r.mode === 'transit' ? Navigation : Car;
                return (
                  <div
                    key={r.id}
                    className="sb-fav-item"
                    onClick={(e) => handleLaunchRoute(e, r)}
                    title={`Click to view route on Live Map: ${r.from} ➔ ${r.to}`}
                  >
                    <div className="sb-fav-item-icon">
                      <RouteIcon size={14} />
                    </div>
                    <div className="sb-fav-item-body">
                      <span className="sb-fav-item-name">{r.name}</span>
                      <span className="sb-fav-item-sub">
                        {r.distance ? `${r.distance} • ` : ''}
                        {r.from.split(',')[0]} ➔ {r.to.split(',')[0]}
                      </span>
                    </div>
                    <div className="sb-fav-item-actions">
                      <button
                        type="button"
                        className="sb-fav-item-btn edit"
                        onClick={(e) => handleEditQuickRoute(e, r)}
                        title="Edit route"
                        aria-label="Edit route"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        type="button"
                        className="sb-fav-item-btn del"
                        onClick={(e) => handleDeleteQuickRoute(e, r.id)}
                        title="Remove from favorites"
                        aria-label="Remove favorite"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Show top favorite places (e.g. Home / Work) */}
              {favoritePlaces.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  className="sb-fav-item place-type"
                  onClick={(e) => handleLaunchPlace(e, p)}
                  title={`Inspect place on Live Map: ${p.address}`}
                >
                  <div className="sb-fav-item-icon place">
                    {p.type === 'work' ? <Briefcase size={14} /> : <Home size={14} />}
                  </div>
                  <div className="sb-fav-item-body">
                    <span className="sb-fav-item-name">{p.name}</span>
                    <span className="sb-fav-item-sub">{p.address}</span>
                  </div>
                  <div className="sb-fav-item-actions">
                    <button
                      type="button"
                      className="sb-fav-item-btn edit"
                      onClick={(e) => handleEditQuickPlace(e, p)}
                      title="Edit place"
                      aria-label="Edit place"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                </div>
              ))}

              {favoriteRoutes.length === 0 && favoritePlaces.length === 0 && (
                <div className="sb-fav-empty">
                  <span>No saved routes yet.</span>
                  <button
                    type="button"
                    onClick={() => setIsAddFavoriteOpen(true)}
                    className="sb-fav-empty-btn"
                  >
                    + Add your first route
                  </button>
                </div>
              )}
            </div>

            {/* Manage all favorites link */}
            <NavLink to="/app/favorites" className="sb-manage-favs-link">
              <span>View All Routes & Place Alerts</span>
              <ChevronRight size={13} />
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className={`sb-realtime-status status-${connectionStatus}`} title={`Real-time incident stream: ${connectionStatus}`}>
            <span className="pulse-dot" />
            <span className="status-label">
              {connectionStatus === 'connected' ? 'LIVE STREAM' : connectionStatus === 'connecting' ? 'CONNECTING…' : 'OFFLINE'}
            </span>
          </div>

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

      {/* Add / Edit Route / Place Modal */}
      <AddFavoriteModal
        isOpen={isAddFavoriteOpen}
        onClose={() => {
          setIsAddFavoriteOpen(false);
          setItemToEdit(null);
        }}
        defaultTab="route"
        itemToEdit={itemToEdit}
      />

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
