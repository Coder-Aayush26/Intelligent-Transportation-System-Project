import { useEffect, useState } from 'react';
import { fetchIncidents, fetchStats } from '../api/incidents';
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
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [incData, statsData] = await Promise.all([fetchIncidents(), fetchStats()]);
        setIncidents(incData || []);
        if (statsData) {
          setStats([
            { value: statsData.totalActive ?? 0, label: 'Total Active Incidents', sub: 'Live updates' },
            { value: statsData.highConfidence ?? 0, label: 'High Confidence', sub: '> 80% confidence' },
            { value: statsData.reportsToday ?? 0, label: 'Reports Today', sub: 'Submitted today' },
            { value: statsData.verifiedToday ?? 0, label: 'Verified Today', sub: '≥ 1 confirmation' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setIncidents([]);
        setStats(EMPTY_STATS);
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
