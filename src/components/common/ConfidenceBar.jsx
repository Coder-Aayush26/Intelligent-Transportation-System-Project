import './ConfidenceBar.css';

// Confidence status thresholds mirror the proposal's
// Unverified -> Probable -> High Confidence/Verified lifecycle.
function colorFor(confidence) {
  if (confidence >= 85) return 'var(--green)';
  if (confidence >= 60) return 'var(--orange)';
  return 'var(--red)';
}

export default function ConfidenceBar({ confidence, showLabel = true, indent = false }) {
  return (
    <div className={indent ? 'confidence-wrap indent' : 'confidence-wrap'}>
      <div className="confidence-track" role="progressbar" aria-valuenow={confidence} aria-valuemin={0} aria-valuemax={100}>
        <div className="confidence-fill" style={{ width: `${confidence}%`, background: colorFor(confidence) }} />
      </div>
      {showLabel && <div className="confidence-label">Confidence: {confidence}%</div>}
    </div>
  );
}
