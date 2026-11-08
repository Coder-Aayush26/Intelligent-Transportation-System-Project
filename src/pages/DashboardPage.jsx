import { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchIncidents, fetchStats } from '../api/incidents';
import { useAppLocation } from '../context/LocationContext';
import { mapLegend } from '../data/mockData';
import LiveMap from '../components/dashboard/LiveMap';
import StatsRow from '../components/dashboard/StatsRow';
import ActiveIncidentsPanel from '../components/dashboard/ActiveIncidentsPanel';
import './DashboardPage.css';

const EMPTY_STATS = [
  { value: 0, label: 'Total Active Incidents', sub: 'Live updates' },
  { value: 0, label: 'High Confidence', sub: '> 80% confidence' },
  { value: 0, label: 'Reports Today', sub: 'Submitted today' },
  { value: 0, label: 'Verified Today', sub: '≥ 1 confirmation' },
];

export default function DashboardPage() {
  const { 
    permissionState, 
    locationError, 
    clearLocationError 
  } = useAppLocation();

  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Category filter state (all enabled by default)
  const [activeCategories, setActiveCategories] = useState(() => {
    const initial = {};
    mapLegend.forEach((item) => { initial[item.label] = true; });
    return initial;
  });

  const [activeSeverity, setActiveSeverity] = useState('All');
  const [incidentsVisible, setIncidentsVisible] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incResult, statsResult] = await Promise.allSettled([
        fetchIncidents(),
        fetchStats(),
      ]);

      if (incResult.status === 'rejected') {
        throw incResult.reason || new Error('Failed to load incident records from server.');
      }

      const incList = Array.isArray(incResult.value) ? incResult.value : [];
      setIncidents(incList);

      const statsData = statsResult.status === 'fulfilled' ? statsResult.value : null;

      // Derive metrics accurately from real incident data + stats endpoint
      const highConfCount = incList.filter((i) => (i.confidence || 0) >= 80).length;
      const verifiedCount = incList.filter((i) => (i.verifications || 0) >= 1 || (i.nearbyVerifications || 0) >= 1).length;

      setStats([
        {
          value: statsData?.totalActive ?? incList.length,
          label: 'Total Active Incidents',
          sub: 'Live updates',
        },
        {
          value: statsData?.highConfidence ?? highConfCount,
          label: 'High Confidence',
          sub: '> 80% confidence',
        },
        {
          value: statsData?.reportsToday ?? 0,
          label: 'Reports Today',
          sub: 'Submitted today',
        },
        {
          value: statsData?.verifiedToday ?? verifiedCount,
          label: 'Verified Today',
          sub: '≥ 1 confirmation',
        },
      ]);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to retrieve incidents from the server. Please check your connection.');
      setIncidents([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleCategory = (cat) => {
    setActiveCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleResetCategories = () => {
    const allActive = {};
    mapLegend.forEach((item) => { allActive[item.label] = true; });
    setActiveCategories(allActive);
    setActiveSeverity('All');
  };

  // Filter incidents for display in both LiveMap and ActiveIncidentsPanel
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const cat = inc.category || 'Other';
      if (activeCategories[cat] === false) return false;
      if (activeSeverity !== 'All') {
        const incSev = (inc.severity || 'Medium').toLowerCase();
        if (incSev !== activeSeverity.toLowerCase()) return false;
      }
      return true;
    });
  }, [incidents, activeCategories, activeSeverity]);

  return (
    <div className="dashboard-container">
      {/* ── Error Banner with Retry ── */}
      {error && (
        <div className="dash-error-banner" role="alert">
          <span>⚠️ {error}</span>
          <button type="button" className="dash-retry-btn" onClick={loadData}>
            ↻ Retry
          </button>
        </div>
      )}

      {/* ── Permission Notice Banner ── */}
      {(permissionState === 'denied' || locationError) && (
        <div className="dash-info-banner" role="status">
          <span>
            📍 <b>Location notice:</b> Device location access is unavailable. You can search any city or area in the top search bar.
          </span>
          <button
            type="button"
            className="dash-dismiss-btn"
            onClick={clearLocationError}
            aria-label="Dismiss location notice"
          >
            ✕
          </button>
        </div>
      )}

      <div className="dash-grid">
        <div>
          <LiveMap
            incidents={incidents}
            loading={loading}
            activeCategories={activeCategories}
            onToggleCategory={handleToggleCategory}
            onResetCategories={handleResetCategories}
            activeSeverity={activeSeverity}
            onSelectSeverity={setActiveSeverity}
            incidentsVisible={incidentsVisible}
            onToggleIncidentsVisible={setIncidentsVisible}
          />
          <StatsRow stats={stats} />
        </div>
        <ActiveIncidentsPanel
          incidents={filteredIncidents}
          loading={loading}
          onRetry={loadData}
          hasError={!!error}
        />
      </div>
    </div>
  );
}
