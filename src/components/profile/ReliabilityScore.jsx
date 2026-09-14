import './ReliabilityScore.css';

function starsFor(score) {
  const full = Math.round(score);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export default function ReliabilityScore({ user }) {
  return (
    <div className="two-col">
      <div className="rel-card">
        <div className="rel-label">Reliability Score</div>
        <div className="rel-big">{user.reliabilityScore}<span className="rel-out-of"> / 5</span></div>
        <div className="stars" aria-hidden="true">{starsFor(user.reliabilityScore)}</div>
        <span className="tag-green">{user.reliabilityLabel}</span>
      </div>
      <div className="rel-card">
        <div className="rel-label">Score Factors</div>
        {user.scoreFactors.map((factor) => (
          <div className="factor-row" key={factor}>
            <span>{factor}</span>
            <span className="check-ok">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}
