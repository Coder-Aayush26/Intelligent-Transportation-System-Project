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
      <div className="meta">{incident.reportedAt} &nbsp;•&nbsp; {incident.severity}</div>
      <ConfidenceBar confidence={incident.confidence} indent />
    </button>
  );
}
