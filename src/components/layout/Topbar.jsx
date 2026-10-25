import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  User, Settings, MapPin, LogOut, ChevronDown, 
  Search, Crosshair, X, Loader2, Bell 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppLocation } from '../../context/LocationContext';
import { geocodeSearch } from '../../api/location';
import { fetchNotifications } from '../../api/incidents';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import './Topbar.css';

export default function Topbar({ title = 'Search city, area, or landmark…' }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const {
    selectedLocation,
    deviceLocation,
    isLocating,
    selectLocation,
    resetToDeviceLocation,
  } = useAppLocation();

  const [notifCount, setNotifCount] = useState(0);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [searchError, setSearchError] = useState('');

  const userDropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Synchronize input value with active selected location when user is not actively typing
  useEffect(() => {
    if (!isFocused) {
      setQuery(selectedLocation?.label || '');
    }
  }, [selectedLocation?.label, isFocused]);

  useEffect(() => {
    fetchNotifications()
      .then((data) => setNotifCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setNotifCount(0));
  }, []);

  // Close dropdowns on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserDropdownOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Debounced search query
  const performSearch = useCallback((searchTerm) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearTimeout(debounceTimerRef.current);

    const clean = searchTerm.trim();
    if (clean.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError('');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setHighlightIndex(-1);

    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      try {
        const results = await geocodeSearch(clean, abortControllerRef.current.signal);
        setSuggestions(results);
        if (results.length === 0) {
          setSearchError(`No locations found for "${clean}"`);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setSearchError('Search request failed. Please check network.');
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 380);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    performSearch(val);
  };

  const handleSelectSuggestion = (item) => {
    // Format a concise clean label (e.g., "Vadodara, Gujarat")
    const parts = (item.displayName || '').split(',').map((s) => s.trim());
    const shortLabel = parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 2] || parts[1]}` : item.displayName;

    selectLocation({
      lat: item.lat,
      lng: item.lng,
      label: shortLabel,
    });

    setQuery(shortLabel);
    setSuggestions([]);
    setIsFocused(false);
    setSearchError('');

    // If on a page other than dashboard/live-map/nearby, switch to live map
    if (pathname !== '/app/dashboard' && pathname !== '/app/live-map' && pathname !== '/app/nearby') {
      navigate('/app/dashboard');
    }
  };

  const handleKeyDown = (e) => {
    if (!isFocused) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        handleSelectSuggestion(suggestions[highlightIndex]);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else if (query.trim().length >= 2) {
        // Force immediate lookup and select first
        geocodeSearch(query.trim())
          .then((results) => {
            if (results.length > 0) {
              handleSelectSuggestion(results[0]);
            } else {
              setSearchError(`No locations found for "${query}"`);
            }
          })
          .catch(() => {
            setSearchError('Failed to search location.');
          });
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setSearchError('');
    setIsSearching(false);
  };

  const handleGpsClick = () => {
    resetToDeviceLocation();
    setIsFocused(false);
    if (pathname !== '/app/dashboard' && pathname !== '/app/live-map' && pathname !== '/app/nearby') {
      navigate('/app/dashboard');
    }
  };

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    setIsUserDropdownOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.fullName || user?.name || 'User';
  const showDropdown = isFocused && (isSearching || suggestions.length > 0 || searchError.length > 0 || deviceLocation);

  return (
    <header className="topbar">
      <div className="search-container" ref={searchContainerRef}>
        <div className="search-box">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            className="search-input"
            placeholder={title}
            aria-label="Search city, area, or landmark"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true);
              if (query.trim().length >= 2 && suggestions.length === 0) {
                performSearch(query);
              }
            }}
            onKeyDown={handleKeyDown}
          />

          {isSearching && (
            <Loader2 size={15} className="spinner" aria-label="Searching…" />
          )}

          {query && !isSearching && (
            <button
              type="button"
              className="search-action-btn"
              onClick={handleClear}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            className={`search-action-btn ${deviceLocation && !selectedLocation.isCustom ? 'active' : ''}`}
            onClick={handleGpsClick}
            disabled={isLocating}
            aria-label="Use my device location"
            title={deviceLocation ? 'Center on device location' : 'Request GPS device location'}
          >
            {isLocating ? (
              <Loader2 size={16} className="spinner" />
            ) : (
              <Crosshair size={16} />
            )}
          </button>
        </div>

        {/* ── Suggestions Dropdown ── */}
        {showDropdown && (
          <div className="search-dropdown" role="listbox">
            {/* Quick action: use current device location if available */}
            {deviceLocation && (
              <button
                type="button"
                className="search-item search-quick-item"
                onClick={handleGpsClick}
              >
                <Crosshair size={15} className="search-item-icon" />
                <div className="search-item-content">
                  <div className="search-item-primary">Use My Device Location</div>
                  <div className="search-item-secondary">
                    {deviceLocation.locality || `${deviceLocation.lat.toFixed(4)}, ${deviceLocation.lng.toFixed(4)}`}
                  </div>
                </div>
              </button>
            )}

            {isSearching && (
              <div className="search-status-item">
                <Loader2 size={15} className="spinner" />
                <span>Searching OpenStreetMap…</span>
              </div>
            )}

            {!isSearching && searchError && (
              <div className="search-status-item">
                <span>{searchError}</span>
              </div>
            )}

            {!isSearching && suggestions.map((item, idx) => {
              const parts = (item.displayName || '').split(',');
              const primary = parts[0]?.trim() || item.displayName;
              const secondary = parts.slice(1, 4).join(',').trim();

              return (
                <button
                  type="button"
                  key={`${item.lat}-${item.lng}-${idx}`}
                  role="option"
                  aria-selected={highlightIndex === idx}
                  className={`search-item ${highlightIndex === idx ? 'highlighted' : ''}`}
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <MapPin size={15} className="search-item-icon" />
                  <div className="search-item-content">
                    <div className="search-item-primary">{primary}</div>
                    {secondary && <div className="search-item-secondary">{secondary}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
          <Bell size={18} />
          {notifCount > 0 && <span className="icon-btn-badge">{notifCount}</span>}
        </button>

        {/* User Dropdown */}
        <div className="user-dropdown-container" ref={userDropdownRef}>
          <button
            className={`user-chip ${isUserDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsUserDropdownOpen((prev) => !prev)}
            aria-expanded={isUserDropdownOpen}
            aria-haspopup="true"
            aria-label="User navigation menu"
          >
            <UserAvatar user={user} size="sm" />
            <span className="n">{displayName}</span>
            <ChevronDown size={14} className={`chevron-icon ${isUserDropdownOpen ? 'open' : ''}`} />
          </button>

          {isUserDropdownOpen && (
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
                onClick={() => setIsUserDropdownOpen(false)}
              >
                <User size={16} className="dropdown-item-icon" />
                <span>My Profile</span>
              </Link>

              <Link
                to="/app/settings"
                className="dropdown-item"
                role="menuitem"
                onClick={() => setIsUserDropdownOpen(false)}
              >
                <Settings size={16} className="dropdown-item-icon" />
                <span>Settings</span>
              </Link>

              <Link
                to="/app/nearby"
                className="dropdown-item"
                role="menuitem"
                onClick={() => setIsUserDropdownOpen(false)}
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
                  setIsUserDropdownOpen(false);
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
