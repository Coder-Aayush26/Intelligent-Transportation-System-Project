import { incidents as mockIncidents } from '../../data/mockData';
import IncidentCard from './IncidentCard';
import Button from '../common/Button';
import './ActiveIncidentsPanel.css';

export default function ActiveIncidentsPanel({ incidents = mockIncidents, loading = false }) {
  return (
    <div className="side-col">
      <h3>Active Incidents</h3>
      {loading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>}
      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} />
      ))}
      {!loading && incidents.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No active incidents right now.</p>
      )}
      <Button variant="outline" full>View All Incidents</Button>
    </div>
  );
}
