import './ReliabilityScore.css';

function starsFor(score) {
  if (score === null || score === undefined) return '☆☆☆☆☆';
  const full = Math.min(5, Math.max(0, Math.round(score)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export default function ReliabilityScore({ user }) {
  const hasActivity = (user?.totalReports ?? 0) > 0 || (user?.totalVerifications ?? 0) > 0;
  const score = user?.reliabilityScore ?? 3.0;

  return (
    <div className="two-col">
      <div className="rel-card">
        <div className="rel-label">Community Reliability Score</div>
        <div className="rel-big">
          {score.toFixed(1)}
          <span className="rel-out-of"> / 5.0</span>
        </div>
        <div className="stars" aria-hidden="true">{starsFor(score)}</div>
        <div style={{ marginTop: 8 }}>
          <span className={hasActivity ? 'tag-green' : 'tag-muted'}>
            {user?.reliabilityLabel || (hasActivity ? 'Active Contributor' : 'Baseline / New Member')}
          </span>
        </div>
        {!hasActivity && (
          <p className="rel-footnote">
            Score is at initial baseline. As your incident reports and photo verifications receive community confirmation, your score dynamically adjusts.
          </p>
        )}
      </div>

      <div className="rel-card">
        <div className="rel-label">Trust & Verification Factors</div>
        {user?.scoreFactors && user.scoreFactors.length > 0 ? (
          user.scoreFactors.map((factor) => (
            <div className="factor-row" key={factor}>
              <span>{factor}</span>
              <span className={hasActivity ? 'check-ok' : 'check-info'}>
                {hasActivity ? '✓' : '•'}
              </span>
            </div>
          ))
        ) : (
          <p className="rel-footnote">
            Trust factors activate once you report or verify incidents in your area.
          </p>
        )}
      </div>
    </div>
  );
}
