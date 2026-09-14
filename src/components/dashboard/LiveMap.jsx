import { useNavigate } from 'react-router-dom';
import { mapLegend, CATEGORY_STYLES } from '../../data/mockData';
import './LiveMap.css';

export default function LiveMap({ incidents = [], loading = false }) {
  const navigate = useNavigate();

  return (
    <div className="map-card">
      <div className="map-canvas">
        <svg width="100%" height="100%" viewBox="0 0 800 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {/* Deep-space base */}
          <rect width="800" height="440" fill="#08101e" />
          {/* City blocks */}
          <g fill="#0d1525" stroke="rgba(56,189,248,0.06)" strokeWidth="1">
            <rect x="40"  y="30"  width="120" height="90" rx="4"/>
            <rect x="200" y="60"  width="90"  height="70" rx="4"/>
            <rect x="520" y="40"  width="110" height="80" rx="4"/>
            <rect x="660" y="90"  width="100" height="90" rx="4"/>
            <rect x="60"  y="260" width="140" height="100" rx="4"/>
            <rect x="600" y="270" width="130" height="110" rx="4"/>
            <rect x="300" y="290" width="100" height="90"  rx="4"/>
          </g>
          {/* Main roads — neon glow lines */}
          <path d="M0,180 C160,150 300,230 460,190 S 650,140 800,170" stroke="rgba(56,189,248,0.12)" strokeWidth="20" fill="none" strokeLinecap="round"/>
          <path d="M120,0 C170,120 90,260 150,440"  stroke="rgba(56,189,248,0.12)" strokeWidth="18" fill="none" strokeLinecap="round"/>
          <path d="M560,0 C520,140 610,260 560,440" stroke="rgba(56,189,248,0.10)" strokeWidth="16" fill="none" strokeLinecap="round"/>
          <path d="M0,340 C220,320 380,360 560,330 S 700,300 800,320" stroke="rgba(56,189,248,0.10)" strokeWidth="18" fill="none" strokeLinecap="round"/>
          {/* Road centre-lines */}
          <path d="M0,180 C160,150 300,230 460,190 S 650,140 800,170" stroke="rgba(56,189,248,0.35)" strokeWidth="1" strokeDasharray="10 8" fill="none"/>
          <path d="M0,340 C220,320 380,360 560,330 S 700,300 800,320" stroke="rgba(56,189,248,0.25)" strokeWidth="1" strokeDasharray="8 6" fill="none"/>
        </svg>

        {loading && (
          <div className="map-loading-overlay">Loading incidents…</div>
        )}

        {incidents.map((incident) => {
          const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
          const pos = incident.mapPosition ?? {};
          return (
            <button
              key={incident.id}
              className="map-pin"
              style={{ top: pos.top ?? '50%', left: pos.left ?? '50%', background: style.color }}
              onClick={() => navigate(`/app/incidents/${incident.id}`)}
              aria-label={`${incident.category} at ${incident.location}`}
            >
              <span>{style.icon}</span>
            </button>
          );
        })}

        <div className="map-controls">
          <button className="map-ctrl-btn" aria-label="Recenter">⛶</button>
          <button className="map-ctrl-btn" aria-label="Zoom in">+</button>
          <button className="map-ctrl-btn" aria-label="Zoom out">−</button>
        </div>
      </div>

      <div className="map-legend">
        {mapLegend.map((item) => (
          <span className="leg-item" key={item.label}>
            <span className="leg-check" style={{ background: item.color }}>✓</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
