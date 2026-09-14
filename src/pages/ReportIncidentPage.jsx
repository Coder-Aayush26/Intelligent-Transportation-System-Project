import ReportForm from '../components/report/ReportForm';
import LocationPreview from '../components/report/LocationPreview';
import './ReportIncidentPage.css';

export default function ReportIncidentPage() {
  return (
    <div>
      <div className="page-title-row">
        <div>
          <h2>Report a New Incident</h2>
          <p>Help others by reporting real-time road conditions.</p>
        </div>
        <div className="acc-badge">📍 Location accuracy: 15m</div>
      </div>

      <div className="form-grid">
        <ReportForm />
        <div>
          <LocationPreview />
          <div className="form-card note-card">
            <h4 className="panel-heading">Why this matters</h4>
            <p className="detail-desc">
              Your report enters automated assessment first, then nearby users confirm it.
              Accurate reports raise your reliability score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
