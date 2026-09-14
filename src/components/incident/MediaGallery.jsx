import './MediaGallery.css';

export default function MediaGallery({ count }) {
  return (
    <div className="detail-card">
      <h4 className="panel-heading">Media</h4>
      <div className="media-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div className="media-ph" key={i}>🖼️</div>
        ))}
        {count === 0 && <p className="detail-desc">No media attached to this report.</p>}
      </div>
    </div>
  );
}
