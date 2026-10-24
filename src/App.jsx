import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RequireAuth from './components/common/RequireAuth';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ReportIncidentPage from './pages/ReportIncidentPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import ProfilePage from './pages/ProfilePage';
import PlaceholderPage from './pages/PlaceholderPage';
import NotificationsPage from './pages/NotificationsPage';
import NearbyIncidentsPage from './pages/NearbyIncidentsPage';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected app shell — wrapped in RequireAuth */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="report" element={<ReportIncidentPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="nearby" element={<NearbyIncidentsPage />} />

        <Route
          path="reports"
          element={<PlaceholderPage title="My Reports" description="A history of incidents you've reported, with their current verification status." />}
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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
