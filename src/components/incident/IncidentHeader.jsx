import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import ConfidenceBar from '../common/ConfidenceBar';
import { CATEGORY_STYLES } from '../../data/mockData';
import './IncidentHeader.css';

const TABS = ['Details', 'Reports', 'Media', 'Timeline', 'Verifications'];

function getIncidentStatus(incident) {
  if (incident.status === 'Resolved' || incident.status === 'expired') {
    return { label: incident.status === 'Resolved' ? 'Resolved / Cleared' : 'Expired / Cleared', bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
  }
  const conf = incident.confidence ?? 50;
  if (conf >= 85) return { label: 'High Confidence', bg: 'var(--green-light)', color: 'var(--green)' };
  if (conf >= 60) return { label: 'Probable Hazard', bg: 'var(--orange-light)', color: 'var(--orange)' };
  return { label: 'Unverified / New', bg: 'var(--red-light)', color: 'var(--red)' };
}

export default function IncidentHeader({ incident }) {
  const [activeTab, setActiveTab] = useState('Details');
  const [copied, setCopied] = useState(false);

  const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
  const statusTier = getIncidentStatus(incident);

  const reportsList = incident.reports || [];
  const reportCount = incident.reportCount || reportsList.length || 1;
  const isExpired = incident.isActive === false || incident.status === 'expired';

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const lat = incident.coords?.lat ?? incident.lat;
  const lng = incident.coords?.lng ?? incident.lng;

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
          <div className="detail-sub">{incident.fullLocation || incident.location}</div>
          {(incident.isConsolidated || reportCount > 1) && (
            <div className="consolidated-pill">
              🔄 Consolidated Incident ({reportCount} Reports)
            </div>
          )}
        </div>
        <span className="badge-pill" style={{ background: statusTier.bg, color: statusTier.color }}>
          {isExpired ? 'Expired' : statusTier.label}
        </span>
      </div>

      <div className="detail-sub">
        Reported {incident.reportedAt || 'recently'} by <b>{incident.reporter || 'Community Member'}</b>
      </div>

      <div className="detail-confidence-row">
        <span>Community Trust & Confidence</span>
        <b>{incident.confidence}%</b>
      </div>
      <ConfidenceBar confidence={incident.confidence} showLabel={false} />

      <div className="tabs" role="tablist">
        {TABS.map((tab) => {
          let badge = '';
          if (tab === 'Reports') badge = ` (${reportCount})`;
          else if (tab === 'Media') badge = ` (${incident.mediaCount || incident.mediaUrls?.length || 0})`;
          else if (tab === 'Verifications') badge = ` (${incident.verifications || incident.nearbyVerifications || 0})`;

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
        <div className="tab-pane-fade">
          <p className="detail-desc">{incident.description || 'No detailed remarks provided.'}</p>
          <div className="kv"><span className="k">📁 Incident Category</span><span>{incident.category}</span></div>
          <div className="kv"><span className="k">👥 Total Reports</span><span><b>{reportCount}</b> independent corroboration(s)</span></div>
          <div className="kv"><span className="k">⚠️ Severity Level</span><span style={{ fontWeight: 600 }}>{incident.severity}</span></div>
          <div className="kv"><span className="k">🚦 Current Status</span><span>{incident.status || (isExpired ? 'Expired / Cleared' : 'Active Road Disruption')}</span></div>
          <div className="kv"><span className="k">🕐 Reported Time</span><span>{incident.reportedTimeFull || incident.reportedAt}</span></div>
          <div className="kv">
            <span className="k">📍 GIS Coordinates</span>
            <span className="mono">{lat?.toFixed?.(4) ?? lat}, {lng?.toFixed?.(4) ?? lng}</span>
          </div>
          <div className="kv"><span className="k">📶 Ingestion Source</span><span>{incident.source || 'Crowdsourced App'}</span></div>
        </div>
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
            {(incident.mediaCount > 0 || (incident.mediaUrls && incident.mediaUrls.length > 0))
              ? `${incident.mediaCount || incident.mediaUrls?.length} visual record(s) attached and evaluated across submitted reports:`
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
        <div className="tab-pane-fade timeline-wrap">
          <div className="timeline-node">
            <div className="timeline-dot dot-origin" />
            <div className="timeline-body">
              <div className="timeline-title">1. Report Ingestion</div>
              <div className="timeline-meta">
                Submitted by {incident.reporter} via {incident.source || 'Web App'} at {incident.reportedTimeFull || incident.reportedAt} ({reportCount} independent corroborations)
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-assessment" />
            <div className="timeline-body">
              <div className="timeline-title">2. Stage-1 AI Assessment & Media Screening</div>
              <div className="timeline-meta">
                Coordinates geo-tagged at ({lat?.toFixed?.(4) ?? lat}, {lng?.toFixed?.(4) ?? lng}). AI Screening: <b>{incident.aiAssessment || (incident.aiAuthenticityScore != null ? `${incident.aiAuthenticityScore}% Authenticity` : 'Pending AI Evaluation')}</b>.
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-verification" />
            <div className="timeline-body">
              <div className="timeline-title">3. Stage-2 Crowdsourced Community Verification</div>
              <div className="timeline-meta">
                Gated to local road users within 1,000m corridor. {incident.nearbyVerifications || 0} confirmation(s) received with {incident.contradictions || 0} contradiction(s).
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-broadcast" />
            <div className="timeline-body">
              <div className="timeline-title">4. Real-Time Broadcast & Lifecycle State</div>
              <div className="timeline-meta">
                Current status: <b>{isExpired ? 'Expired' : statusTier.label}</b> ({incident.confidence}% confidence). Active in geofenced proximity alert feeds.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Verifications' && (
        <div className="tab-pane-fade">
          <div className="formula-box">
            <div className="formula-label">Confidence Assessment Function (Proposal §7):</div>
            <code className="formula-math">C = w1·M + w2·F + w3·U + w4·RR ± R(t)</code>
          </div>

          <div className="kv">
            <span className="k">Nc — Independent Confirmations</span>
            <b>{incident.nearbyVerifications || 0} user(s)</b>
          </div>
          <div className="kv">
            <span className="k">Nr — Contradictory Responses</span>
            <b>{incident.contradictions || 0} user(s)</b>
          </div>
          <div className="kv">
            <span className="k">R — Contributing User Reliability</span>
            <b>{incident.avgReliability || 4.2} / 5.0</b>
          </div>
          <div className="kv">
            <span className="k">E — Supporting Evidence</span>
            <b>{incident.mediaCount || incident.mediaUrls?.length || 0} photo(s)</b>
          </div>
          <div className="kv">
            <span className="k">P, T — Proximity & Temporal Consistency</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>Active corridor window</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button 
          type="button" 
          className="btn btn-outline btn-sm" 
          onClick={handleShare}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Share2 size={14} />}
          <span>{copied ? 'Link Copied to Clipboard!' : 'Share Incident'}</span>
        </button>
      </div>
    </div>
  );
}
