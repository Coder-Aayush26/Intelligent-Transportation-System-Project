import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import ConfidenceBar from '../common/ConfidenceBar';
import { CATEGORY_STYLES } from '../../data/mockData';
import './IncidentHeader.css';

const TABS = ['Details', 'Media', 'Timeline', 'Verifications'];

function getIncidentStatus(incident) {
  if (incident.status === 'Resolved') {
    return { label: 'Resolved / Cleared', bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
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
      <div className="detail-head">
        <div className="detail-icon" style={{ background: style.bg, color: style.color }}>
          {style.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="detail-title">{incident.category}</h3>
          <div className="detail-sub">{incident.fullLocation || incident.location}</div>
        </div>
        <span className="badge-pill" style={{ background: statusTier.bg, color: statusTier.color }}>
          {statusTier.label}
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
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={'tab' + (activeTab === tab ? ' active' : '')}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'Media' ? ` (${incident.mediaCount || incident.mediaUrls?.length || 0})` : ''}
            {tab === 'Verifications' ? ` (${incident.verifications || incident.nearbyVerifications || 0})` : ''}
          </button>
        ))}
      </div>

      {activeTab === 'Details' && (
        <div className="tab-pane-fade">
          <p className="detail-desc">{incident.description || 'No detailed remarks provided.'}</p>
          <div className="kv"><span className="k">📁 Incident Category</span><span>{incident.category}</span></div>
          <div className="kv"><span className="k">⚠️ Severity Level</span><span style={{ fontWeight: 600 }}>{incident.severity}</span></div>
          <div className="kv"><span className="k">🕐 Reported Time</span><span>{incident.reportedTimeFull || incident.reportedAt}</span></div>
          <div className="kv">
            <span className="k">📍 GIS Coordinates</span>
            <span className="mono">{lat?.toFixed?.(4) ?? lat}, {lng?.toFixed?.(4) ?? lng}</span>
          </div>
          <div className="kv"><span className="k">📶 Ingestion Source</span><span>{incident.source || 'Crowdsourced App'}</span></div>
        </div>
      )}

      {activeTab === 'Media' && (
        <div className="tab-pane-fade">
          <p className="detail-desc">
            {incident.mediaCount || incident.mediaUrls?.length
              ? `${incident.mediaCount || incident.mediaUrls?.length} supporting media file(s) attached — see the Media Gallery panel on the right.`
              : 'No supporting photo or video attached for this incident.'}
          </p>
        </div>
      )}

      {activeTab === 'Timeline' && (
        <div className="tab-pane-fade timeline-wrap">
          <div className="timeline-node">
            <div className="timeline-dot dot-origin" />
            <div className="timeline-body">
              <div className="timeline-title">1. Report Ingestion</div>
              <div className="timeline-meta">
                Submitted by {incident.reporter} via {incident.source || 'Web App'} at {incident.reportedTimeFull || incident.reportedAt}
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-assessment" />
            <div className="timeline-body">
              <div className="timeline-title">2. Automated Assessment & GIS Tagging</div>
              <div className="timeline-meta">
                Coordinates geo-tagged at ({lat?.toFixed?.(4)}, {lng?.toFixed?.(4)}). Automated consistency check: {incident.aiAssessment || 'Likely Real'}.
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-verification" />
            <div className="timeline-body">
              <div className="timeline-title">3. Crowdsourced Community Verification</div>
              <div className="timeline-meta">
                {incident.nearbyVerifications || 0} independent nearby confirmation(s) received with {incident.contradictions || 0} contradiction(s).
              </div>
            </div>
          </div>

          <div className="timeline-node">
            <div className="timeline-dot dot-broadcast" />
            <div className="timeline-body">
              <div className="timeline-title">4. Real-Time Broadcast & Lifecycle State</div>
              <div className="timeline-meta">
                Current status: <b>{statusTier.label}</b> ({incident.confidence}% confidence). Active in geofenced proximity alert feeds.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Verifications' && (
        <div className="tab-pane-fade">
          <div className="formula-box">
            <div className="formula-label">Confidence Assessment Function (Proposal §7):</div>
            <code className="formula-math">C = f(Nc, P, T, R, E, Nr)</code>
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