import { useState, useEffect, useMemo } from 'react';
import { 
  ThumbsUp, ThumbsDown, CheckCircle2, ShieldCheck, 
  AlertCircle, MapPin, Lock, Navigation
} from 'lucide-react';
import { verifyIncident } from '../../api/incidents';
import { useAppLocation } from '../../context/LocationContext';
import './VerificationSummary.css';

/** Great circle distance between two points in metres (Haversine formula). */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const AI_MIN_THRESHOLD = 70; // Proposal §2: AI minimum authenticity threshold
const PROXIMITY_LIMIT_METERS = 1000; // Proposal §5: Maximum 1000m voting radius

export default function VerificationSummary({ incident, onIncidentUpdate }) {
  const { deviceLocation, selectedLocation, requestDeviceLocation, isLocating } = useAppLocation();

  const [userVote, setUserVote] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const reportCount = incident.reportCount || incident.reports?.length || 1;
  const isExpired = incident.isActive === false || incident.status === 'expired';

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

  // Coordinates
  const incLat = incident.coords?.lat ?? incident.lat;
  const incLng = incident.coords?.lng ?? incident.lng;

  // Prefer true device GPS coordinates; fallback to active searched location if available
  const userCoords = useMemo(() => {
    if (deviceLocation?.lat != null && deviceLocation?.lng != null) {
      return { lat: deviceLocation.lat, lng: deviceLocation.lng, source: 'GPS' };
    }
    if (selectedLocation?.lat != null && selectedLocation?.lng != null) {
      return { lat: selectedLocation.lat, lng: selectedLocation.lng, source: selectedLocation.isCustom ? 'Searched' : 'Device' };
    }
    return null;
  }, [deviceLocation, selectedLocation]);

  // Distance calculation
  const distanceMeters = useMemo(() => {
    if (!userCoords || incLat == null || incLng == null) return null;
    return getDistanceMeters(userCoords.lat, userCoords.lng, incLat, incLng);
  }, [userCoords, incLat, incLng]);

  // Gate 1: Stage-1 AI Verification Threshold (evaluated by Gemini Vision)
  const hasMedia = Boolean(
    (Array.isArray(incident.mediaUrls) && incident.mediaUrls.length > 0) ||
    incident.mediaCount > 0
  );
  const aiScore = incident.aiAuthenticityScore ?? (incident.mediaScore != null ? Math.round(incident.mediaScore * 100) : (incident.mediaAuthenticity?.score != null ? Math.round(incident.mediaAuthenticity.score * 100) : 0));
  const isAiApproved = Boolean(incident.aiVerified ?? (hasMedia ? aiScore >= AI_MIN_THRESHOLD : true));

  // Gate 2: Proximity Gate (within 1000 meters)
  const isWithinProximity = distanceMeters != null && distanceMeters <= PROXIMITY_LIMIT_METERS;

  // Full verification permission
  const canVote = isAiApproved && isWithinProximity;

  const handleVote = async (verdict) => {
    if (submitting || !incident?.id) return;

    if (!isAiApproved) {
      setError(`Cannot vote: Incident has not passed Stage-1 AI verification (Score: ${aiScore}% < ${AI_MIN_THRESHOLD}%).`);
      return;
    }

    if (!userCoords) {
      setError('Device GPS location is required to verify you are within 1,000 meters of this incident.');
      return;
    }

    if (!isWithinProximity) {
      setError(`Proximity restriction: You are ${Math.round(distanceMeters)}m away. You must be within 1,000 meters (1.0 km) to vote.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await verifyIncident(incident.id, verdict, userCoords);
      setUserVote(verdict);
      try {
        localStorage.setItem(`its_vote_${incident.id}`, verdict);
      } catch {
        // ignore
      }

      const updated = { ...incident };
      if (res && res.new_confidence != null) {
        updated.confidence = res.new_confidence;
      }
      if (res && res.confirmations != null) {
        updated.nearbyVerifications = res.confirmations;
      }
      if (res && res.contradictions != null) {
        updated.contradictions = res.contradictions;
      }
      if (verdict === 'resolve') {
        updated.status = 'Resolved';
      }

      if (onIncidentUpdate) {
        onIncidentUpdate(updated);
      }

      setFeedback(
        verdict === 'confirm'
          ? '✓ Confirmation registered! Confidence reinforced.'
          : verdict === 'resolve'
          ? '✓ Incident reported resolved by community response.'
          : '✓ Contradiction recorded and factored into reliability score.'
      );
      setTimeout(() => setFeedback(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to submit verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isResolved = incident?.status === 'Resolved';

  return (
    <div className="detail-card verif-summary-card">
      <div className="verif-card-header">
        <h4 className="panel-heading" style={{ margin: 0 }}>Verification Summary</h4>
        <span className="verif-model-badge">
          <ShieldCheck size={14} />
          <span>2-Stage Pipeline</span>
        </span>
      </div>

      <div className="verif-metrics-list">
        <div className="verif-row">
          <span className="verif-label">Corroborating Reports</span>
          <span className="check-ok">✓ {reportCount} Independent Report(s)</span>
        </div>

        <div className="verif-row verif-row-ai">
          <div className="verif-row-top">
            <span className="verif-label">Stage 1: AI Authenticity Screening</span>
            <span className={isAiApproved ? 'check-ok' : 'check-warn'}>
              {isAiApproved ? `✓ Passed (${aiScore}%)` : `⚠ Flagged / Below 70% (${aiScore}%)`}
            </span>
          </div>
          {incident.aiAssessment && (
            <div className="verif-ai-response">
              <span className="verif-ai-tag">Gemini Multimodal Vision</span>
              <span className="verif-ai-text">“{incident.aiAssessment}”</span>
            </div>
          )}
        </div>

        {incident.mediaAuthenticity && (
          <div className="verif-row">
            <span className="verif-label">AI Visual Consistency</span>
            <span className={incident.mediaAuthenticity.score >= 0.7 ? 'check-ok' : incident.mediaAuthenticity.score >= 0.35 ? 'check-warn' : 'check-err'}>
              {incident.mediaAuthenticity.score >= 0.7 ? '✓' : incident.mediaAuthenticity.score >= 0.35 ? '⚠' : '✕'}{' '}
              {incident.mediaAuthenticity.description_consistency === 'verified_match'
                ? 'Verified Match'
                : incident.mediaAuthenticity.description_consistency === 'inconsistent_mismatch'
                ? 'Inconsistent Mismatch'
                : incident.mediaAuthenticity.evidence_quality === 'synthetic_or_dummy'
                ? 'Rejected Dummy'
                : `${Math.round(incident.mediaAuthenticity.score * 100)}% Authentic`}
            </span>
          </div>
        )}

        <div className="verif-row">
          <span className="verif-label">Stage 2: Community Confirmations</span>
          <span className="check-ok">✓ {incident.nearbyVerifications || 0} Confirmed (≤1km)</span>
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

        <div className="verif-row">
          <span className="verif-label">Voter Proximity Threshold</span>
          <b className="verif-val">≤ 1,000 metres</b>
        </div>

        {isExpired && (
          <div className="verif-row">
            <span className="verif-label">Lifecycle Status</span>
            <span className="check-warn">⏱️ Expired / Auto-Resolved</span>
          </div>
        )}
      </div>

      {/* ── Community Verification Section with 2-Stage Gating ── */}
      <div className="community-action-section">
        <div className="community-action-head">
          <span className="community-action-title">
            👥 Stage 2: Community Verification
          </span>
          <span className="community-action-sub">
            Only nearby road users within 1,000m can validate incidents after Stage-1 AI approval:
          </span>
        </div>

        {/* Gate 1 Warning: AI Screening Incomplete */}
        {!isAiApproved && (
          <div className="verif-gate-banner gate-ai-locked" role="alert">
            <Lock size={15} />
            <div>
              <strong>Voting Locked: Stage-1 AI Screening Pending</strong>
              <p>
                This incident has an AI authenticity score of <b>{aiScore}%</b> (Required: ≥{AI_MIN_THRESHOLD}%).
                Community verification unlocks only once media evidence passes automated authenticity analysis.
              </p>
            </div>
          </div>
        )}

        {/* Gate 2: Proximity Check Status */}
        {isAiApproved && (
          <>
            {!userCoords ? (
              <div className="verif-gate-banner gate-gps-needed">
                <Navigation size={15} />
                <div>
                  <strong>Device Location Required</strong>
                  <p>Please share your device GPS coordinates to confirm you are within 1,000 metres of this incident.</p>
                  <button
                    type="button"
                    className="verif-gps-btn"
                    onClick={() => requestDeviceLocation(true)}
                    disabled={isLocating}
                  >
                    {isLocating ? 'Acquiring GPS…' : '📍 Verify My Distance'}
                  </button>
                </div>
              </div>
            ) : isWithinProximity ? (
              <div className="verif-gate-banner gate-eligible">
                <MapPin size={15} />
                <div>
                  <strong>✅ Eligible to Vote</strong>
                  <p>
                    You are <b>{Math.round(distanceMeters)} metres away</b> from this incident (within the 1,000m corridor).
                  </p>
                </div>
              </div>
            ) : (
              <div className="verif-gate-banner gate-out-of-range" role="alert">
                <Lock size={15} />
                <div>
                  <strong>Voting Restricted: Out of 1,000m Proximity</strong>
                  <p>
                    You are <b>{(distanceMeters / 1000).toFixed(2)} km</b> away ({Math.round(distanceMeters)}m).
                    Per Proposal §5, community verification is strictly limited to users within 1,000 metres (1.0 km) of the reported hazard.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {feedback && (
          <div className="verif-feedback-banner" role="status">
            {feedback}
          </div>
        )}

        {error && (
          <div className="verif-error-banner" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Voting Action Buttons — Gated by AI approval & 1000m proximity */}
        <div className="verif-action-buttons">
          <button
            type="button"
            className={`btn-verif btn-confirm ${userVote === 'confirm' ? 'selected' : ''}`}
            onClick={() => handleVote('confirm')}
            disabled={submitting || !canVote}
            title={
              !canVote 
                ? !isAiApproved ? 'Locked: Stage-1 AI approval required' : 'Locked: You must be within 1,000m to verify'
                : 'Confirm that this incident is currently present'
            }
          >
            <ThumbsUp size={16} />
            <span>Confirm Active</span>
            {userVote === 'confirm' && <span className="vote-badge">Voted</span>}
          </button>

          <button
            type="button"
            className={`btn-verif btn-contradict ${userVote === 'contradict' ? 'selected' : ''}`}
            onClick={() => handleVote('contradict')}
            disabled={submitting || !canVote}
            title={
              !canVote 
                ? !isAiApproved ? 'Locked: Stage-1 AI approval required' : 'Locked: You must be within 1,000m to dispute'
                : 'Flag this report as inaccurate, cleared, or not present'
            }
          >
            <ThumbsDown size={16} />
            <span>Not Here</span>
            {userVote === 'contradict' && <span className="vote-badge">Voted</span>}
          </button>

          <button
            type="button"
            className={`btn-verif btn-resolve ${userVote === 'resolve' || isResolved ? 'selected' : ''}`}
            onClick={() => handleVote('resolve')}
            disabled={submitting || isResolved || !canVote}
            title={
              !canVote 
                ? 'Locked: Requires AI approval & ≤1000m proximity'
                : 'Indicate that this incident has cleared up'
            }
          >
            <CheckCircle2 size={16} />
            <span>{isResolved ? 'Resolved' : 'Mark Cleared'}</span>
            {userVote === 'resolve' && <span className="vote-badge">Voted</span>}
          </button>
        </div>

        <div className="community-notice">
          ℹ️ Multi-stage verification prevents spam: <b>Stage 1</b> checks image manipulation & consistency (≥70%). <b>Stage 2</b> limits verification to local users within 1,000m.
        </div>
      </div>
    </div>
  );
}
