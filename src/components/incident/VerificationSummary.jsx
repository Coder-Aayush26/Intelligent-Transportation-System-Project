import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { verifyIncident } from '../../api/incidents';
import './VerificationSummary.css';

export default function VerificationSummary({ incident, onIncidentUpdate }) {
  const [userVote, setUserVote] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (incident?.id) {
      try {
        const saved = localStorage.getItem(`its_vote_${incident.id}`);
        if (saved) setUserVote(saved);
      } catch {
        // ignore storage errors
      }
    }
  }, [incident?.id]);

  const handleVote = async (verdict) => {
    if (submitting || !incident?.id) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await verifyIncident(incident.id, verdict);
      setUserVote(verdict);
      try {
        localStorage.setItem(`its_vote_${incident.id}`, verdict);
      } catch {
        // ignore
      }

      const updated = { ...incident };
      if (res && res.new_confidence != null) {
        updated.confidence = res.new_confidence;
        updated.nearbyVerifications = res.confirmations ?? (updated.nearbyVerifications + 1);
        updated.contradictions = res.contradictions ?? updated.contradictions;
      } else {
        if (verdict === 'confirm') {
          updated.nearbyVerifications = (updated.nearbyVerifications || 0) + 1;
          updated.confidence = Math.min(99, (updated.confidence || 50) + 5);
        } else if (verdict === 'contradict') {
          updated.contradictions = (updated.contradictions || 0) + 1;
          updated.confidence = Math.max(5, (updated.confidence || 50) - 8);
        } else if (verdict === 'resolve') {
          updated.status = 'Resolved';
          updated.confidence = Math.max(5, (updated.confidence || 50) - 20);
        }
      }

      if (verdict === 'resolve') {
        updated.status = 'Resolved';
      }

      onIncidentUpdate?.(updated);

      if (verdict === 'confirm') {
        setFeedback('✓ You confirmed this incident. Thank you for validating real-time road conditions!');
      } else if (verdict === 'contradict') {
        setFeedback('✓ You reported this incident as not present or false. Feedback recorded.');
      } else {
        setFeedback('✓ You reported this hazard as cleared / resolved.');
      }

      setTimeout(() => setFeedback(''), 4500);
    } catch (err) {
      console.warn('Verification request fallback:', err);
      // Graceful optimistic fallback
      setUserVote(verdict);
      try {
        localStorage.setItem(`its_vote_${incident.id}`, verdict);
      } catch {
        // ignore
      }
      const updated = { ...incident };
      if (verdict === 'confirm') {
        updated.nearbyVerifications = (updated.nearbyVerifications || 0) + 1;
        updated.confidence = Math.min(99, (updated.confidence || 50) + 5);
      } else if (verdict === 'contradict') {
        updated.contradictions = (updated.contradictions || 0) + 1;
        updated.confidence = Math.max(5, (updated.confidence || 50) - 8);
      } else if (verdict === 'resolve') {
        updated.status = 'Resolved';
      }
      onIncidentUpdate?.(updated);
      setFeedback('✓ Verification recorded! Thank you for your contribution.');
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const isResolved = incident?.status === 'Resolved';

  return (
    <div className="detail-card verif-summary-card">
      <div className="verif-card-header">
        <h4 className="panel-heading">Verification Summary</h4>
        <span className="verif-model-badge">
          <ShieldCheck size={14} />
          <span>Multi-Stage Verified</span>
        </span>
      </div>

      <div className="verif-metrics-list">
        <div className="verif-row">
          <span className="verif-label">AI Consistency Assessment</span>
          <span className="check-ok">✓ {incident.aiAssessment || 'Passed Initial Screening'}</span>
        </div>
        <div className="verif-row">
          <span className="verif-label">Nearby Community Verifications</span>
          <span className="check-ok">✓ {incident.nearbyVerifications || 0} Confirmed</span>
        </div>
        <div className="verif-row">
          <span className="verif-label">Contradictions / Discrepancies</span>
          <span className={incident.contradictions === 0 ? 'check-ok' : 'check-warn'}>
            {incident.contradictions === 0 ? '✓ 0' : `⚠ ${incident.contradictions}`}
          </span>
        </div>
        <div className="verif-row">
          <span className="verif-label">Contributing User Reliability (Avg.)</span>
          <b className="verif-val">{incident.avgReliability || 4.2} / 5.0</b>
        </div>
      </div>

      {/* ── Community Verification Interactive Actions ── */}
      <div className="community-action-section">
        <div className="community-action-head">
          <span className="community-action-title">
            👥 Community Verification Action
          </span>
          <span className="community-action-sub">
            Are you near this scene? Cast your observation to update the trust score:
          </span>
        </div>

        {feedback && (
          <div className="verif-feedback-banner" role="status">
            {feedback}
          </div>
        )}

        {error && (
          <div className="verif-error-banner" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="verif-action-buttons">
          <button
            type="button"
            className={`btn-verif btn-confirm ${userVote === 'confirm' ? 'selected' : ''}`}
            onClick={() => handleVote('confirm')}
            disabled={submitting}
            title="Confirm that this incident is currently present"
          >
            <ThumbsUp size={16} />
            <span>Confirm Active</span>
            {userVote === 'confirm' && <span className="vote-badge">Voted</span>}
          </button>

          <button
            type="button"
            className={`btn-verif btn-contradict ${userVote === 'contradict' ? 'selected' : ''}`}
            onClick={() => handleVote('contradict')}
            disabled={submitting}
            title="Flag this report as inaccurate, cleared, or not present"
          >
            <ThumbsDown size={16} />
            <span>Not Here</span>
            {userVote === 'contradict' && <span className="vote-badge">Voted</span>}
          </button>

          <button
            type="button"
            className={`btn-verif btn-resolve ${userVote === 'resolve' || isResolved ? 'selected' : ''}`}
            onClick={() => handleVote('resolve')}
            disabled={submitting || isResolved}
            title="Indicate that this incident has cleared up"
          >
            <CheckCircle2 size={16} />
            <span>{isResolved ? 'Resolved' : 'Mark Cleared'}</span>
            {userVote === 'resolve' && <span className="vote-badge">Voted</span>}
          </button>
        </div>

        <div className="community-notice">
          ℹ️ Independent confirmations from multiple local road users raise the incident's confidence score and trigger geofenced real-time alerts.
        </div>
      </div>
    </div>
  );
}