import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchUserSettings, updateUserSettings, updateUserLocation } from '../api/users';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import EditProfileModal from '../components/profile/EditProfileModal';
import AvatarUploadModal from '../components/profile/AvatarUploadModal';
import './SettingsPage.css';

const RADIUS_OPTIONS = [
  { value: 0.5, label: '500 metres', hint: 'Immediate block / neighborhood' },
  { value: 1.0, label: '1 kilometre', hint: 'Local commute corridor' },
  { value: 2.0, label: '2 kilometres', hint: 'Default urban radius' },
  { value: 5.0, label: '5 kilometres', hint: 'Suburban / arterial roads' },
  { value: 10.0, label: '10 kilometres', hint: 'Regional transit coverage' },
];

const INCIDENT_CATEGORIES = [
  { key: 'Accident', label: 'Accidents & Collisions', icon: '💥' },
  { key: 'Congestion', label: 'Severe Traffic Congestion', icon: '🚗' },
  { key: 'Road Blockage', label: 'Road Blockages & Closures', icon: '🚧' },
  { key: 'Waterlogging', label: 'Waterlogging & Flooding', icon: '🌊' },
  { key: 'Construction', label: 'Construction & Road Work', icon: '🏗️' },
  { key: 'Hazard', label: 'Potholes & Road Hazards', icon: '⚠️' },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modals
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Browser notification status
  const [browserPerm, setBrowserPerm] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  });

  // Location tracking status
  const [locatingStatus, setLocatingStatus] = useState('');

  const showStatus = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchUserSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load user settings:', err);
      // Fallback defaults if offline
      setSettings({
        notificationRadius: 2.0,
        nearbyVerificationRequests: true,
        nearbyNewIncidents: true,
        highSeverityAlerts: true,
        categories: {
          Accident: true,
          Congestion: true,
          'Road Blockage': true,
          Waterlogging: true,
          Construction: true,
          Hazard: true,
        },
        locationSharingEnabled: false,
        browserNotificationsEnabled: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const persistSettings = async (newSettings) => {
    setSettings(newSettings);
    setSaving(true);
    setErrorMessage('');
    try {
      await updateUserSettings(newSettings);
      showStatus('Settings saved successfully');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  // Section 1: Radius change
  const handleRadiusChange = (radius) => {
    const updated = { ...settings, notificationRadius: radius };
    persistSettings(updated);
  };

  // Section 2: General notification toggle
  const handleToggle = (key) => {
    const updated = { ...settings, [key]: !settings[key] };
    persistSettings(updated);
  };

  // Category toggle
  const handleCategoryToggle = (catKey) => {
    const updatedCats = {
      ...(settings.categories || {}),
      [catKey]: !settings.categories?.[catKey],
    };
    const updated = { ...settings, categories: updatedCats };
    persistSettings(updated);
  };

  // Section 3: Location sharing toggle
  const handleLocationSharingToggle = () => {
    const nextState = !settings.locationSharingEnabled;

    if (!nextState) {
      // Disabling location sharing
      setLocatingStatus('');
      try {
        sessionStorage.removeItem('its_lat');
        sessionStorage.removeItem('its_lng');
      } catch {
        // ignore
      }
      const updated = { ...settings, locationSharingEnabled: false };
      persistSettings(updated);
      showStatus('Location sharing disabled.');
      return;
    }

    // Enabling location sharing: request browser permission
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setLocatingStatus('Requesting current GPS coordinates…');
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          sessionStorage.setItem('its_lat', String(latitude));
          sessionStorage.setItem('its_lng', String(longitude));
          await updateUserLocation({ lat: latitude, lng: longitude });
        } catch {
          // ignore
        }
        setLocatingStatus(`Active: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        const updated = { ...settings, locationSharingEnabled: true };
        persistSettings(updated);
        showStatus('Location sharing enabled and coordinates verified.');
      },
      (err) => {
        setLocatingStatus('');
        setErrorMessage(
          err.code === 1
            ? 'Location permission was denied in your browser settings. Please allow location access to enable this feature.'
            : 'Unable to retrieve location. Please check your GPS/device settings.'
        );
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  // Section 4: Browser Notification request
  const handleRequestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') {
      setErrorMessage('Browser push notifications are not supported on this platform.');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
      if (perm === 'granted') {
        const updated = { ...settings, browserNotificationsEnabled: true };
        persistSettings(updated);
        showStatus('Browser notifications enabled.');
        new Notification('ITS Alerts Active', {
          body: 'You will receive real-time incident notifications while this browser session is active.',
        });
      } else {
        const updated = { ...settings, browserNotificationsEnabled: false };
        persistSettings(updated);
        setErrorMessage('Browser notifications were blocked. Please enable them in your browser URL bar.');
      }
    } catch (err) {
      setErrorMessage('Failed to request notification permission: ' + err.message);
    }
  };

  // Section 5: Logout confirmation
  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="settings-page">
        <p className="loading-state">Loading your preferences…</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>Settings & Preferences</h2>
          <p>Configure notification proximity, incident categories, and privacy controls.</p>
        </div>
        <div className="settings-status-tag">
          {saving ? 'Saving…' : statusMessage ? `✓ ${statusMessage}` : 'Synced with Cloud'}
        </div>
      </div>

      {errorMessage && (
        <div className="settings-error-banner" role="alert">
          ⚠ {errorMessage}
        </div>
      )}

      {/* SECTION 1: Location & Proximity */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="card-icon" aria-hidden="true">📍</div>
          <div>
            <h3>Location & Alert Proximity</h3>
            <p>Determine how close an incident must be for you to receive alerts or verification requests.</p>
          </div>
        </div>

        <div className="radius-options-grid">
          {RADIUS_OPTIONS.map((opt) => {
            const isSelected = settings?.notificationRadius === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`radius-option-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleRadiusChange(opt.value)}
                disabled={saving}
                aria-pressed={isSelected}
              >
                <div className="radius-val">{opt.label}</div>
                <div className="radius-hint">{opt.hint}</div>
                {isSelected && <span className="radius-check">✓ Active</span>}
              </button>
            );
          })}
        </div>
        <span className="settings-footnote">
          Currently filtering alerts within <b>{settings?.notificationRadius || 2} km</b> of your active or reported area.
        </span>
      </section>

      {/* SECTION 2: Notification Preferences */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="card-icon" aria-hidden="true">🔔</div>
          <div>
            <h3>Notification Types</h3>
            <p>Choose what types of traffic events trigger notifications.</p>
          </div>
        </div>

        <div className="toggle-list">
          <div className="toggle-row">
            <div>
              <div className="toggle-title">Nearby Verification Requests</div>
              <div className="toggle-desc">
                Prompts when an incident occurs near you, asking for confirmation or photo evidence.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.nearbyVerificationRequests}
              className={`switch-btn ${settings?.nearbyVerificationRequests ? 'on' : 'off'}`}
              onClick={() => handleToggle('nearbyVerificationRequests')}
              disabled={saving}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-title">New Incidents in Range</div>
              <div className="toggle-desc">
                Real-time alerts when any new traffic hazard is reported inside your proximity radius.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.nearbyNewIncidents}
              className={`switch-btn ${settings?.nearbyNewIncidents ? 'on' : 'off'}`}
              onClick={() => handleToggle('nearbyNewIncidents')}
              disabled={saving}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-title">High-Severity Hazards Only</div>
              <div className="toggle-desc">
                Prioritize Critical and High severity events (e.g. major multi-vehicle crashes, flash floods).
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.highSeverityAlerts}
              className={`switch-btn ${settings?.highSeverityAlerts ? 'on' : 'off'}`}
              onClick={() => handleToggle('highSeverityAlerts')}
              disabled={saving}
            >
              <span className="switch-thumb" />
            </button>
          </div>
        </div>

        <h4 className="sub-heading">Subscribed Incident Categories</h4>
        <div className="categories-grid">
          {INCIDENT_CATEGORIES.map((cat) => {
            const isEnabled = settings?.categories?.[cat.key] ?? true;
            return (
              <button
                key={cat.key}
                type="button"
                className={`category-pill-btn ${isEnabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleCategoryToggle(cat.key)}
                disabled={saving}
                aria-pressed={isEnabled}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="cat-status">{isEnabled ? '✓' : '✕'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Location-Sharing Controls */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="card-icon" aria-hidden="true">🛰️</div>
          <div>
            <h3>Location Sharing & Proximity Verification</h3>
            <p>Allow the system to check if you are near reported incidents while the web app is in use.</p>
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-title">Share Session Location for Verification</div>
            <div className="toggle-desc">
              Your device GPS is used exclusively to dispatch verification and photo requests when incidents occur nearby.
              Exact coordinates are never published to other users.
            </div>
            {locatingStatus && <div className="locating-pill">📡 {locatingStatus}</div>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings?.locationSharingEnabled}
            className={`switch-btn ${settings?.locationSharingEnabled ? 'on' : 'off'}`}
            onClick={handleLocationSharingToggle}
            disabled={saving}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        <div className="privacy-callout">
          <strong>Privacy Notice:</strong> Location updates are only captured while this tab is active.
          When disabled, all stored session coordinates are cleared immediately.
        </div>
      </section>

      {/* SECTION 4: Browser & In-App Notifications */}
      <section className="settings-card">
        <div className="settings-card-head">
          <div className="card-icon" aria-hidden="true">🖥️</div>
          <div>
            <h3>Browser & System Alerts</h3>
            <p>Manage system notifications delivered directly through your web browser.</p>
          </div>
        </div>

        <div className="browser-notif-box">
          <div className="browser-notif-info">
            <span className="notif-badge">
              Permission: <b>{browserPerm.toUpperCase()}</b>
            </span>
            <p className="notif-explanation">
              In-session alerts display toast messages while the app is open. Enabling browser push notifications allows banner notifications on your desktop or mobile device during your active browsing session.
            </p>
          </div>

          {browserPerm !== 'granted' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRequestBrowserPermission}
              disabled={browserPerm === 'denied'}
            >
              {browserPerm === 'denied' ? 'Permission Denied in Browser' : 'Enable Browser Notifications'}
            </Button>
          )}
        </div>
      </section>

      {/* SECTION 5: Account Controls */}
      <section className="settings-card account-card">
        <div className="settings-card-head">
          <div className="card-icon" aria-hidden="true">👤</div>
          <div>
            <h3>Account & Session</h3>
            <p>Manage your account identity, profile details, and session security.</p>
          </div>
        </div>

        <div className="account-details-preview">
          <div>
            <div className="acc-name">{user?.fullName || user?.name || 'User'}</div>
            <div className="acc-email">{user?.email || 'Authenticated User'}</div>
          </div>
          <div className="account-btn-group">
            <Button variant="outline" size="sm" onClick={() => setIsEditProfileOpen(true)}>
              Edit Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsAvatarModalOpen(true)}>
              Change Photo
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsLogoutModalOpen(true)}
            >
              Log Out
            </Button>
          </div>
        </div>
      </section>

      {/* Modals */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        user={user}
        onClose={() => setIsEditProfileOpen(false)}
        onUpdated={() => {
          showStatus('Profile updated!');
        }}
      />

      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        user={user}
        onClose={() => setIsAvatarModalOpen(false)}
        onUpdated={() => {
          showStatus('Photo updated!');
        }}
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
    </div>
  );
}
