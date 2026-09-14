import './VerificationSummary.css';

export default function VerificationSummary({ incident }) {
  return (
    <div className="detail-card">
      <h4 className="panel-heading">Verification Summary</h4>
      <div className="verif-row">
        <span>AI Assessment</span>
        <span className="check-ok">✓ {incident.aiAssessment}</span>
      </div>
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
    </div>
  );
}
