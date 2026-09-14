import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

const TITLES = {
  '/app/dashboard': 'Search location…',
  '/app/report': 'New incident report',
  '/app/profile': 'My profile',
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || 'Search location…';

  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <Topbar title={title} />
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
