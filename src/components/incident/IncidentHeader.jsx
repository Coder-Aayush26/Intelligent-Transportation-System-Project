import { useState } from 'react';
import ConfidenceBar from '../common/ConfidenceBar';
import { CATEGORY_STYLES } from '../../data/mockData';
import './IncidentHeader.css';

const TABS = ['Details', 'Media', 'Timeline', 'Verifications'];

function confidenceTier(confidence) {
  if (confidence >= 85) return { label: 'High Confidence', bg: 'var(--green-light)', color: 'var(--green)' };
  if (confidence >= 60) return { label: 'Probable', bg: 'var(--orange-light)', color: 'var(--orange)' };
  return { label: 'Unverified', bg: 'var(--red-light)', color: 'var(--red)' };
}

export default function IncidentHeader({ incident }) {
  const [activeTab, setActiveTab] = useState('Details');
  const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
  const tier = confidenceTier(incident.confidence);

  return (
    <div className="detail-card">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: style.bg, color: style.color }}>
          {style.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="detail-title">{incident.category}</h3>
        </div>
        <span className="badge-pill" style={{ background: tier.bg, color: tier.color }}>
          {tier.label}
        </span>
      </div>

      <div className="detail-sub">{incident.fullLocation}</div>
      <div className="detail-sub">Reported {incident.reportedAt} by <b>{incident.reporter}</b></div>

      <div className="detail-confidence-row">
        <span>Confidence Score</span>
        <b>{incident.confidence}%</b>
      </div>
      <ConfidenceBar confidence={incident.confidence} showLabel={false} />

      <div className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={'tab' + (activeTab === tab ? ' active' : '')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}{tab === 'Media' ? ` (${incident.mediaCount})` : ''}{tab === 'Verifications' ? ` (${incident.verifications})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'Details' && (
        <>
          <p className="detail-desc">{incident.description}</p>
          <div className="kv"><span className="k">📁 Category</span><span>{incident.category}</span></div>
          <div className="kv"><span className="k">🕐 Reported Time</span><span>{incident.reportedTimeFull}</span></div>
          <div className="kv"><span className="k">📍 Location</span><span className="mono">{incident.coords.lat}, {incident.coords.lng}</span></div>
          <div className="kv"><span className="k">📶 Source</span><span>{incident.source}</span></div>
        </>
      )}

      {activeTab === 'Media' && (
        <p className="detail-desc">{incident.mediaCount} file(s) attached — see the Media panel.</p>
      )}

      {activeTab === 'Timeline' && (
        <p className="detail-desc">Reported {incident.reportedTimeFull}, then routed through automated assessment and community verification.</p>
      )}

      {activeTab === 'Verifications' && (
        <p className="detail-desc">{incident.nearbyVerifications} nearby users confirmed this report, with {incident.contradictions} contradiction(s) recorded.</p>
      )}

      <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }}>↗ Share Incident</button>
    </div>
  );
}
