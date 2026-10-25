import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAppLocation } from '../../context/LocationContext';
import './AppLayout.css';

const TITLES = {
  '/app/dashboard': 'Search location…',
  '/app/report': 'New incident report',
  '/app/profile': 'My profile',
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'Search location…';
  const { deviceLocation, permissionState, requestDeviceLocation, isLocating } = useAppLocation();

  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <Topbar title={title} />
        {!deviceLocation && permissionState !== 'denied' && (
          <div className="location-prompt-banner">
            <div className="loc-prompt-content">
              <span className="loc-prompt-icon">📍</span>
              <div className="loc-prompt-text">
                <strong>Enable GPS Location</strong>
                <span>Allow GPS access so ITS can continuously show and calculate nearby traffic incidents around you.</span>
              </div>
            </div>
            <button
              type="button"
              className="loc-prompt-btn"
              onClick={() => requestDeviceLocation(true)}
              disabled={isLocating}
            >
              {isLocating ? 'Acquiring GPS…' : 'Allow GPS Access'}
            </button>
          </div>
        )}
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
