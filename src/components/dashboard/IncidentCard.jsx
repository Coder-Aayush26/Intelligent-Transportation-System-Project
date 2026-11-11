import { useNavigate } from 'react-router-dom';
import ConfidenceBar from '../common/ConfidenceBar';
import { CATEGORY_STYLES } from '../../data/mockData';
import './IncidentCard.css';

export default function IncidentCard({ incident }) {
  const navigate = useNavigate();
  const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;

  return (
    <button
      className="incident-card"
      onClick={() => navigate(`/app/incidents/${incident.id}`)}
    >
      <div className="inc-head">
        <div className="inc-icon" style={{ background: style.bg, color: style.color }}>
          {style.icon}
        </div>
        <div className="inc-title">{incident.category}</div>
      </div>
      <div className="loc">{incident.location}</div>
      <div className="meta">
        {incident.reportedAt} &nbsp;•&nbsp; {incident.severity}
        {(incident.reportCount > 1 || incident.isConsolidated) && (
          <span style={{ marginLeft: 6, background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
            👥 {incident.reportCount} reports
          </span>
        )}
      </div>
      <ConfidenceBar confidence={incident.confidence} indent />
    </button>
  );
}
