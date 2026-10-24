import { useState } from 'react';
import ReportForm from '../components/report/ReportForm';
import LocationPreview from '../components/report/LocationPreview';
import './ReportIncidentPage.css';

export default function ReportIncidentPage() {
  // Lifted GPS state — shared between ReportForm (writes) and LocationPreview (reads)
  const [gpsLocation, setGpsLocation] = useState(null);
  // { lat, lng, address, timestamp }

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
        <ReportForm onLocationAcquired={setGpsLocation} />
        <div>
          <LocationPreview
            lat={gpsLocation?.lat}
            lng={gpsLocation?.lng}
            address={gpsLocation?.address}
            timestamp={gpsLocation?.timestamp}
          />
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
