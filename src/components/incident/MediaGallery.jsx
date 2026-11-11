import './MediaGallery.css';

export default function MediaGallery({ count, mediaUrls = [], authenticity, aiAssessment }) {
  const hasUrls = mediaUrls && mediaUrls.length > 0;
  
  // Format quality and consistency badge classes
  const consistency = authenticity?.description_consistency || '';
  const isMatch = consistency === 'verified_match' || consistency === 'partial_match';
  const isMismatch = consistency === 'inconsistent_mismatch';

  const scorePct = authenticity?.score !== undefined && authenticity?.score !== null
    ? Math.round(authenticity.score * 100)
    : null;

  return (
    <div className="detail-card media-gallery-card">
      <div className="media-gallery-header">
        <h4 className="panel-heading" style={{ margin: 0 }}>Visual Evidence & AI Authenticity</h4>
        {scorePct !== null && (
          <span className={`auth-badge ${scorePct >= 70 ? 'auth-good' : scorePct >= 35 ? 'auth-warn' : 'auth-bad'}`}>
            {scorePct >= 70 ? '✓' : scorePct >= 35 ? '⚠' : '✕'} {scorePct}% Authenticity
          </span>
        )}
      </div>

      <div className="media-grid" style={{ marginTop: 12 }}>
        {hasUrls ? (
          mediaUrls.map((url, i) => (
            <div className="media-ph" key={i} style={{ padding: 0, overflow: 'hidden' }}>
              <img src={url} alt={`Incident media ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))
        ) : count > 0 ? (
          Array.from({ length: count }).map((_, i) => (
            <div className="media-ph" key={i}>🖼️</div>
          ))
        ) : (
          <p className="detail-desc" style={{ gridColumn: '1 / -1' }}>No media attached to this report.</p>
        )}
      </div>

      {(authenticity || aiAssessment) && (
        <div className="ai-auth-box">
          <div className="ai-auth-top">
            <span className="ai-auth-title">🤖 Multimodal Scene Verification</span>
            {authenticity?.description_consistency && (
              <span className={`ai-consistency-pill ${isMatch ? 'match' : isMismatch ? 'mismatch' : 'dummy'}`}>
                {isMatch ? '✓ Verified Description Match' : isMismatch ? '⚠ Inconsistent Mismatch' : '✕ Synthetic / Dummy Evidence'}
              </span>
            )}
          </div>

          <p className="ai-auth-summary">
            {authenticity?.assessment || aiAssessment}
          </p>

          {authenticity && (
            <div className="ai-auth-details">
              {authenticity.detected_scene && (
                <div className="ai-auth-kv">
                  <span className="ai-auth-k">Detected Scene:</span>
                  <span className="ai-auth-v">{authenticity.detected_scene}</span>
                </div>
              )}
              {authenticity.evidence_quality && (
                <div className="ai-auth-kv">
                  <span className="ai-auth-k">Evidence Quality:</span>
                  <span className="ai-auth-v" style={{ textTransform: 'capitalize' }}>
                    {authenticity.evidence_quality.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {authenticity.reasoning && (
                <div className="ai-auth-kv">
                  <span className="ai-auth-k">AI Reasoning:</span>
                  <span className="ai-auth-v">{authenticity.reasoning}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
