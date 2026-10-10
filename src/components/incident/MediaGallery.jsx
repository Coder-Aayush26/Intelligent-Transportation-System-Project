import './MediaGallery.css';

export default function MediaGallery({ count, mediaUrls = [] }) {
  // If we have actual URLs (Cloudinary), use them. Otherwise fallback to mock placeholders if count > 0.
  const hasUrls = mediaUrls && mediaUrls.length > 0;
  
  return (
    <div className="detail-card">
      <h4 className="panel-heading">Media</h4>
      <div className="media-grid">
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
          <p className="detail-desc">No media attached to this report.</p>
        )}
      </div>
    </div>
  );
}
