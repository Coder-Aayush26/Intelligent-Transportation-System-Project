import { useState } from 'react';
import ConfidenceBar from '../common/ConfidenceBar';
import { CATEGORY_STYLES } from '../../data/mockData';
import './IncidentHeader.css';

const TABS = ['Details', 'Reports', 'Media', 'Timeline', 'Verifications'];

function confidenceTier(confidence) {
  if (confidence >= 85) return { label: 'High Confidence', bg: 'var(--green-light)', color: 'var(--green)' };
  if (confidence >= 60) return { label: 'Probable', bg: 'var(--orange-light)', color: 'var(--orange)' };
  return { label: 'Unverified', bg: 'var(--red-light)', color: 'var(--red)' };
}

export default function IncidentHeader({ incident }) {
  const [activeTab, setActiveTab] = useState('Details');
  const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
  const tier = confidenceTier(incident.confidence);
  const reportsList = incident.reports || [];
  const reportCount = incident.reportCount || reportsList.length || 1;
  const isExpired = incident.isActive === false || incident.status === 'expired';

  return (
    <div className="detail-card">
      {isExpired && (
        <div className="expired-banner">
          ⏱️ <b>Incident Expired / Resolved:</b> This road disruption has cleared or reached its active lifespan. Historical reports and verification details are preserved below.
        </div>
      )}

      <div className="detail-head">
        <div className="detail-icon" style={{ background: style.bg, color: style.color }}>
          {style.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="detail-title">{incident.category}</h3>
          {(incident.isConsolidated || reportCount > 1) && (
            <div className="consolidated-pill">
              🔄 Consolidated Incident ({reportCount} Reports)
            </div>
          )}
        </div>
        <span className="badge-pill" style={{ background: tier.bg, color: tier.color }}>
          {isExpired ? 'Expired' : tier.label}
        </span>
      </div>

      <div className="detail-sub">{incident.fullLocation}</div>
      <div className="detail-sub">
        Latest activity {incident.reportedAt} by <b>{incident.reporter}</b>
      </div>

      <div className="detail-confidence-row">
        <span>Confidence Score</span>
        <b>{incident.confidence}%</b>
      </div>
      <ConfidenceBar confidence={incident.confidence} showLabel={false} />

      <div className="tabs" role="tablist">
        {TABS.map((tab) => {
          let badge = '';
          if (tab === 'Reports') badge = ` (${reportCount})`;
          else if (tab === 'Media') badge = ` (${incident.mediaCount})`;
          else if (tab === 'Verifications') badge = ` (${incident.verifications})`;

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={'tab' + (activeTab === tab ? ' active' : '')}
              onClick={() => setActiveTab(tab)}
            >
              {tab}{badge}
            </button>
          );
        })}
      </div>

      {activeTab === 'Details' && (
        <>
          <p className="detail-desc">{incident.description}</p>
          <div className="kv"><span className="k">📁 Category</span><span>{incident.category}</span></div>
          <div className="kv"><span className="k">👥 Total Reports</span><span><b>{reportCount}</b> independent corroboration(s)</span></div>
          <div className="kv"><span className="k">🚦 Current Status</span><span>{isExpired ? 'Expired / Cleared' : 'Active Road Disruption'}</span></div>
          <div className="kv"><span className="k">🕐 Latest Reported Time</span><span>{incident.reportedTimeFull}</span></div>
          <div className="kv"><span className="k">📍 Primary Location</span><span className="mono">{incident.coords?.lat}, {incident.coords?.lng}</span></div>
          <div className="kv"><span className="k">📶 Primary Source</span><span>{incident.source}</span></div>
        </>
      )}

      {activeTab === 'Reports' && (
        <div className="reports-container">
          <p className="detail-desc" style={{ marginBottom: 4 }}>
            Multiple users reported this incident within a 100-meter radius. All individual reports are consolidated below:
          </p>
          {reportsList.length > 0 ? (
            reportsList.map((r, idx) => (
              <div key={r.reportId || idx} className="report-item-card">
                <div className="report-item-header">
                  <span className={`report-badge ${idx === 0 ? 'primary' : 'corrob'}`}>
                    {idx === 0 ? 'Primary Report' : `Corroboration #${idx + 1}`}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    {r.reportedAt} ({r.reportedTimeFull})
                  </span>
                </div>
                <div className="report-meta-row">
                  <span>Reporter: <b>{r.reporter}</b></span>
                  <span>Reliability: <b>{r.reporterReliability}/5</b></span>
                </div>
                <p className="report-text">{r.description || 'No description provided.'}</p>
                <div className="report-tags-row">
                  <span className="report-tag-item">📍 {r.location || `${r.coords?.lat}, ${r.coords?.lng}`}</span>
                  <span className="report-tag-item">⚡ Severity: {r.severity}</span>
                  {r.mediaCount > 0 && <span className="report-tag-item">📷 {r.mediaCount} media</span>}
                  <span className="report-tag-item">📶 {r.source}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="detail-desc">Initial report submitted by {incident.reporter}.</p>
          )}
        </div>
      )}

      {activeTab === 'Media' && (
        <div className="media-tab-content">
          <p className="detail-desc" style={{ marginBottom: 10 }}>
            {incident.mediaCount > 0
              ? `${incident.mediaCount} visual record(s) attached and verified across submitted reports:`
              : 'No media visual records uploaded for this incident.'}
          </p>
          {incident.mediaUrls && incident.mediaUrls.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {incident.mediaUrls.map((url, i) => (
                <div key={i} style={{ aspectRatio: 1, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  <img src={url} alt={`Evidence ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
          {incident.mediaAuthenticity && (
            <div className="report-item-card" style={{ marginTop: 10 }}>
              <div className="report-item-header">
                <span className="report-badge primary">AI Visual Authenticity</span>
                <span style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: incident.mediaAuthenticity.score >= 0.7 ? '#4ade80' : incident.mediaAuthenticity.score >= 0.35 ? '#fbbf24' : '#f87171'
                }}>
                  {Math.round(incident.mediaAuthenticity.score * 100)}% Authenticity
                </span>
              </div>
              <p className="report-text" style={{ marginTop: 6, fontWeight: 500 }}>
                {incident.mediaAuthenticity.assessment}
              </p>
              {incident.mediaAuthenticity.detected_scene && (
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  <b>Scene:</b> {incident.mediaAuthenticity.detected_scene}
                </div>
              )}
              {incident.mediaAuthenticity.reasoning && (
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                  <b>Reasoning:</b> {incident.mediaAuthenticity.reasoning}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Timeline' && (
        <p className="detail-desc">
          Reported {incident.reportedTimeFull}, reinforced with {reportCount} independent corroborations and {incident.nearbyVerifications} community confirmations.
        </p>
      )}

      {activeTab === 'Verifications' && (
        <p className="detail-desc">
          {incident.nearbyVerifications} nearby users confirmed this report, with {incident.contradictions} contradiction(s) recorded.
        </p>
      )}

      <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }}>↗ Share Incident</button>
    </div>
  );
}
