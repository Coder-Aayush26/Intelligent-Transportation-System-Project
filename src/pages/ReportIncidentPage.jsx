import { useState, useMemo } from 'react';
import { useAppLocation } from '../context/LocationContext';
import ReportForm from '../components/report/ReportForm';
import LocationPreview from '../components/report/LocationPreview';
import './ReportIncidentPage.css';

export default function ReportIncidentPage() {
  const { selectedLocation, deviceLocation } = useAppLocation();

  // Lifted location state updated by ReportForm
  const [activeLocation, setActiveLocation] = useState(null);

  const displayLat = activeLocation?.lat ?? selectedLocation?.lat ?? deviceLocation?.lat ?? 22.7196;
  const displayLng = activeLocation?.lng ?? selectedLocation?.lng ?? deviceLocation?.lng ?? 75.8577;
  const displayAddress = activeLocation?.address ?? selectedLocation?.label ?? deviceLocation?.locality ?? 'Indore, Madhya Pradesh';

  const badgeText = useMemo(() => {
    if (deviceLocation?.accuracy) {
      return `📍 GPS Accuracy: ±${Math.round(deviceLocation.accuracy)}m`;
    }
    if (selectedLocation?.label) {
      return `📍 Area: ${selectedLocation.label.split(',')[0]}`;
    }
    return '📍 Location: Session Synced';
  }, [deviceLocation, selectedLocation]);

  return (
    <div>
      <div className="page-title-row">
        <div>
          <h2>Report a New Incident</h2>
          <p>Help others by reporting real-time road conditions.</p>
        </div>
        <div className="acc-badge">{badgeText}</div>
      </div>

      <div className="form-grid">
        <ReportForm onLocationAcquired={setActiveLocation} />
        <div>
          <LocationPreview
            lat={displayLat}
            lng={displayLng}
            address={displayAddress}
            timestamp={activeLocation?.timestamp}
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
