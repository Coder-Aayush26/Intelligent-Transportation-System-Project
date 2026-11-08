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
import SettingsPage from './pages/SettingsPage';
import MyReportsPage from './pages/MyReportsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuthorityPortalPage from './pages/AuthorityPortalPage';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Dedicated Standalone Authority & Emergency Operations Portal */}
      <Route path="/authority" element={<AuthorityPortalPage />} />

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
        <Route path="live-map" element={<DashboardPage />} />
        <Route path="report" element={<ReportIncidentPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="nearby" element={<NearbyIncidentsPage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="reports" element={<MyReportsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="authority" element={<Navigate to="/authority" replace />} />
        <Route
          path="favorites"
          element={<PlaceholderPage title="Favorites" description="Routes and locations you're watching for incident updates." />}
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
