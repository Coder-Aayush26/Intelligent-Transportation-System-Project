import { useEffect, useState } from 'react';
import { incidents as mockIncidents, dashboardStats as mockStats } from '../data/mockData';
import { fetchIncidents, fetchStats } from '../api/incidents';
import LiveMap from '../components/dashboard/LiveMap';
import StatsRow from '../components/dashboard/StatsRow';
import ActiveIncidentsPanel from '../components/dashboard/ActiveIncidentsPanel';
import './DashboardPage.css';

export default function DashboardPage() {
  const [incidents, setIncidents] = useState(mockIncidents);
  const [stats, setStats] = useState(mockStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [incData, statsData] = await Promise.all([fetchIncidents(), fetchStats()]);
        setIncidents(incData);
        // Map backend stats shape to the array shape LiveMap/StatsRow expect
        setStats([
          { value: statsData.totalActive,    label: 'Total Active Incidents', sub: 'Live updates' },
          { value: statsData.highConfidence, label: 'High Confidence',        sub: '> 80% confidence' },
          { value: statsData.reportsToday,   label: 'Reports Today',          sub: 'Submitted today' },
          { value: statsData.verifiedToday,  label: 'Verified Today',         sub: '≥ 1 confirmation' },
        ]);
      } catch {
        // Backend not running — keep showing mock data, no error shown to user.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="dash-grid">
      <div>
        <LiveMap incidents={incidents} loading={loading} />
        <StatsRow stats={stats} />
      </div>
      <ActiveIncidentsPanel incidents={incidents} loading={loading} />
    </div>
  );
}
