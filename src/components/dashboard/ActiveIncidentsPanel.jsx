import IncidentCard from './IncidentCard';
import './ActiveIncidentsPanel.css';

export default function ActiveIncidentsPanel({ 
  incidents = [], 
  loading = false, 
  hasError = false, 
  onRetry = null 
}) {
  return (
    <div className="side-col">
      <h3>Active Incidents ({incidents.length})</h3>

      {loading && (
        <p style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>
          Loading active incidents…
        </p>
      )}

      {hasError && !loading && (
        <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--red)' }}>
          <p>Failed to load incidents.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                marginTop: 8,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              ↻ Try Again
            </button>
          )}
        </div>
      )}

      {!loading && !hasError && incidents.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted)', padding: '16px 0' }}>
          No active incidents right now. All clear!
        </p>
      )}

      {!loading && !hasError && incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} />
      ))}
    </div>
  );
}
