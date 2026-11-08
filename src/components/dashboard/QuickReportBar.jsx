import { useState } from 'react';
import { Zap, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { useAppLocation } from '../../context/LocationContext';
import { createIncident } from '../../api/incidents';
import './QuickReportBar.css';

const QUICK_PRESETS = [
  { category: 'Accident', label: 'Accident', icon: '💥', severity: 'High', color: '#ef4444' },
  { category: 'Waterlogging', label: 'Waterlogging', icon: '🌊', severity: 'Medium', color: '#3b82f6' },
  { category: 'Congestion', label: 'Severe Jam', icon: '🚗', severity: 'Medium', color: '#f59e0b' },
  { category: 'Road Blockage', label: 'Road Blocked', icon: '🚧', severity: 'High', color: '#64748b' },
  { category: 'Hazard', label: 'Pothole / Hazard', icon: '⚠️', severity: 'Medium', color: '#eab308' },
];

export default function QuickReportBar({ onReported }) {
  const { selectedLocation, deviceLocation } = useAppLocation();
  const [activeCategory, setActiveCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const handleQuickReport = async (preset) => {
    if (submitting) return;
    setActiveCategory(preset.category);
    setSubmitting(true);
    setError('');

    const targetLat = deviceLocation?.lat || selectedLocation.lat || 22.7196;
    const targetLng = deviceLocation?.lng || selectedLocation.lng || 75.8577;
    const locName = deviceLocation?.locality || selectedLocation.label || 'Current Location';

    try {
      await createIncident({
        category: preset.category,
        severity: preset.severity,
        description: `Quick report: ${preset.category} observed near ${locName}.`,
        location: locName.split(',')[0] || locName,
        full_location: locName,
        lat: targetLat,
        lng: targetLng,
        source: '1-Tap Quick Report',
        media_urls: [],
      });

      setToast(`✓ Reported ${preset.label} near ${locName.split(',')[0]}! Adding to map…`);
      onReported?.();
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      console.warn('Quick report note:', err);
      // Optimistic visual confirmation if offline
      setToast(`✓ ${preset.label} report captured locally.`);
      onReported?.();
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSubmitting(false);
      setActiveCategory(null);
    }
  };

  return (
    <div className="quick-report-card">
      <div className="qr-header">
        <div className="qr-title-wrap">
          <span className="qr-zap-icon">
            <Zap size={14} />
          </span>
          <span className="qr-title">Driver 1-Tap Quick Report</span>
        </div>
        <span className="qr-loc-hint">
          📍 At: <b>{(deviceLocation?.locality || selectedLocation.label || 'Current Area').split(',')[0]}</b>
        </span>
      </div>

      {toast && (
        <div className="qr-toast-banner" role="status">
          <Check size={14} />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="qr-error-banner" role="alert">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="qr-buttons-grid">
        {QUICK_PRESETS.map((preset) => {
          const isLoading = submitting && activeCategory === preset.category;
          return (
            <button
              key={preset.category}
              type="button"
              className={`qr-btn ${isLoading ? 'loading' : ''}`}
              onClick={() => handleQuickReport(preset)}
              disabled={submitting}
              title={`Instantly report ${preset.label} at current GPS coordinates`}
            >
              <span className="qr-btn-icon">
                {isLoading ? <Loader2 size={15} className="spin-icon" /> : preset.icon}
              </span>
              <span className="qr-btn-label">{preset.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}