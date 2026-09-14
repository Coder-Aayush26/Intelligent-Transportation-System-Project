import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import ReportIncidentPage from './pages/ReportIncidentPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import ProfilePage from './pages/ProfilePage';
import PlaceholderPage from './pages/PlaceholderPage';

export default function App() {
  return (
    <Routes>
      {/* Public marketing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Authenticated app shell (sidebar + topbar) wraps every /app/* route */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="report" element={<ReportIncidentPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* Sidebar items scoped for a future build-out — kept as real
            routes now so the nav's active state and links are correct. */}
        <Route
          path="reports"
          element={<PlaceholderPage title="My Reports" description="A history of incidents you've reported, with their current verification status." />}
        />
        <Route
          path="nearby"
          element={<PlaceholderPage title="Nearby Incidents" description="Incidents within your notification radius, ranked by proximity." />}
        />
        <Route
          path="notifications"
          element={<PlaceholderPage title="Notifications" description="Real-time alerts for high-confidence incidents near you." />}
        />
        <Route
          path="favorites"
          element={<PlaceholderPage title="Favorites" description="Routes and locations you're watching for incident updates." />}
        />
        <Route
          path="analytics"
          element={<PlaceholderPage title="Analytics" description="Historical GIS analysis — hotspots, recurring disruptions, and trends." />}
        />
        <Route
          path="settings"
          element={<PlaceholderPage title="Settings" description="Notification radius, alert preferences, and account settings." />}
        />
      </Route>

      {/* Fallback for unknown paths */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
