import './VerificationSummary.css';

export default function VerificationSummary({ incident }) {
  const reportCount = incident.reportCount || incident.reports?.length || 1;
  const isExpired = incident.isActive === false || incident.status === 'expired';

  return (
    <div className="detail-card">
      <h4 className="panel-heading">Verification Summary</h4>
      <div className="verif-row">
        <span>Corroborating Reports</span>
        <span className="check-ok">✓ {reportCount} Independent Report(s)</span>
      </div>
      <div className="verif-row">
        <span>AI Assessment</span>
        <span className="check-ok">✓ {incident.aiAssessment}</span>
      </div>
      {incident.mediaAuthenticity && (
        <div className="verif-row">
          <span>AI Media Authenticity</span>
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
        <span>Nearby Verifications</span>
        <span className="check-ok">✓ {incident.nearbyVerifications} Confirmed</span>
      </div>
      <div className="verif-row">
        <span>Contradictions</span>
        <span className={incident.contradictions === 0 ? 'check-ok' : 'check-warn'}>
          {incident.contradictions === 0 ? '✓ 0' : `⚠ ${incident.contradictions}`}
        </span>
      </div>
      <div className="verif-row">
        <span>User Reliability (Avg.)</span>
        <b>{incident.avgReliability} / 5</b>
      </div>
      {isExpired && (
        <div className="verif-row">
          <span>Lifecycle Status</span>
          <span className="check-warn">⏱️ Expired / Auto-Resolved</span>
        </div>
      )}
    </div>
  );
}
