import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RequireAuth from './components/common/RequireAuth';

// Code-split route components for optimal initial bundle delivery & faster page paint
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportIncidentPage = lazy(() => import('./pages/ReportIncidentPage'));
const IncidentDetailPage = lazy(() => import('./pages/IncidentDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const NearbyIncidentsPage = lazy(() => import('./pages/NearbyIncidentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AuthorityPortalPage = lazy(() => import('./pages/AuthorityPortalPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: '12px',
      color: '#64748b',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e2e8f0',
        borderTopColor: '#2563eb',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>Loading ITS views…</span>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
          <Route path="favorites" element={<FavoritesPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
