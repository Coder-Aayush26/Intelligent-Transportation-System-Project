import { useNavigate } from 'react-router-dom';
import { X, MapPin } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext';
import './RealtimeToast.css';

export default function RealtimeToast() {
  const { toasts, dismissToast } = useRealtime();
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="realtime-toast-container" aria-live="polite">
      {toasts.map((t) => {
        const sevClass = `severity-${(t.severity || 'medium').toLowerCase()}`;
        return (
          <div key={t.id} className={`realtime-toast ${sevClass}`} role="alert">
            <div className="toast-header-row">
              <div className="toast-tag-group">
                <span className="toast-category-badge">{t.category || 'Incident'}</span>
                <span className={`toast-severity-pill sev-${(t.severity || '').toLowerCase()}`}>
                  {t.severity}
                </span>
              </div>
              <button
                type="button"
                className="toast-close-btn"
                aria-label="Dismiss alert"
                onClick={() => dismissToast(t.id)}
              >
                <X size={15} />
              </button>
            </div>

            <h5 className="toast-title">{t.title}</h5>

            <div className="toast-location">
              <MapPin size={13} />
              <span>{t.location}</span>
            </div>

            {t.description && <p className="toast-desc">{t.description}</p>}

            {t.incidentId && (
              <div className="toast-actions">
                <button
                  type="button"
                  className="toast-view-btn"
                  onClick={() => {
                    dismissToast(t.id);
                    navigate(`/app/incidents/${t.incidentId}`);
                  }}
                >
                  View Details →
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
