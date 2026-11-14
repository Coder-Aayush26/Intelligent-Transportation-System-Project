import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Navigation, Shield, AlertTriangle, CheckCircle2, 
  Search, X, ArrowRight, RotateCcw 
} from 'lucide-react';
import { useAppLocation } from '../../context/LocationContext';
import { geocodeSearch } from '../../api/location';
import Button from './Button';
import './LocationPromptModal.css';

export default function LocationPromptModal({ isOpen, onClose }) {
  const { 
    requestDeviceLocation, 
    selectLocation, 
    deviceLocation,
    permissionState 
  } = useAppLocation();

  // Dialog step: 'prompt' | 'locating' | 'success' | 'denied'
  const [step, setStep] = useState('prompt');
  const [errorMessage, setErrorMessage] = useState('');
  const [acquiredDetails, setAcquiredDetails] = useState(null);

  // Manual fallback search state
  const [manualQuery, setManualQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);

  const searchAbortRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Reset modal state whenever opened
  useEffect(() => {
    if (isOpen) {
      if (permissionState === 'denied') {
        setStep('denied');
        setShowManualSearch(true);
      } else {
        setStep('prompt');
        setShowManualSearch(false);
      }
      setErrorMessage('');
      setManualQuery('');
      setSearchResults([]);
    }
  }, [isOpen, permissionState]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && step !== 'locating') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  // Debounced manual search
  useEffect(() => {
    const q = manualQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();

    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsSearching(true);
      try {
        const results = await geocodeSearch(q, controller.signal);
        setSearchResults(results || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding search failed:', err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [manualQuery]);

  const handleRequestLocation = async () => {
    setStep('locating');
    setErrorMessage('');

    try {
      const loc = await requestDeviceLocation(true);
      const locality = loc?.locality || 'Your current area';
      const lat = loc?.lat || 0;
      const lng = loc?.lng || 0;

      setAcquiredDetails({ locality, lat, lng });
      setStep('success');

      // Auto-proceed after brief success confirmation
      setTimeout(() => {
        onClose?.(true);
      }, 1400);
    } catch (err) {
      console.warn('Location prompt error:', err);
      let msg = 'Could not access device location.';
      if (err?.code === 1) {
        msg = 'Location permission was denied. You can select your city or area manually below.';
      } else if (err?.code === 2) {
        msg = 'Device location is temporarily unavailable. Please select your city manually.';
      } else if (err?.code === 3) {
        msg = 'GPS request timed out. Please try again or search for your city.';
      }
      setErrorMessage(msg);
      setStep('denied');
      setShowManualSearch(true);
    }
  };

  const handleSelectManual = (item) => {
    selectLocation({
      lat: item.lat,
      lng: item.lng,
      label: item.displayName,
    });
    setAcquiredDetails({
      locality: item.displayName.split(',')[0],
      lat: item.lat,
      lng: item.lng,
    });
    setStep('success');
    setTimeout(() => {
      onClose?.(true);
    }, 1200);
  };

  const handleDismiss = () => {
    onClose?.(true);
  };

  if (!isOpen) return null;

  return (
    <div className="loc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="loc-modal-title">
      <div className="loc-modal-card">
        {/* Close / Skip button */}
        {step !== 'locating' && (
          <button 
            type="button" 
            className="loc-modal-close" 
            onClick={handleDismiss} 
            title="Skip for now"
            aria-label="Skip location setup"
          >
            <X size={18} />
          </button>
        )}

        {/* STEP 1: INITIAL PROMPT */}
        {step === 'prompt' && (
          <div className="loc-modal-body">
            <div className="loc-radar-container">
              <div className="loc-radar-ring ring-1"></div>
              <div className="loc-radar-ring ring-2"></div>
              <div className="loc-radar-icon">
                <Navigation size={32} className="loc-nav-svg" />
              </div>
            </div>

            <h2 id="loc-modal-title" className="loc-modal-title">
              Enable Real-Time Location Access
            </h2>
            <p className="loc-modal-desc">
              Welcome to <strong>ITS</strong>! To deliver live traffic intelligence, auto-center maps on your road, and unlock community incident verification, we need your location.
            </p>

            {/* Benefit highlights */}
            <div className="loc-benefits-grid">
              <div className="loc-benefit-item">
                <span className="benefit-icon">🚨</span>
                <div>
                  <strong>Nearby Incident Alerts</strong>
                  <span>Instant alerts for road accidents and traffic jams within 10 km.</span>
                </div>
              </div>
              <div className="loc-benefit-item">
                <span className="benefit-icon">🛡️</span>
                <div>
                  <strong>1,000m Verification Voting</strong>
                  <span>Confirm or dispute reported disruptions when driving or walking nearby.</span>
                </div>
              </div>
              <div className="loc-benefit-item">
                <span className="benefit-icon">⚡</span>
                <div>
                  <strong>Instant Hazard Reporting</strong>
                  <span>Automatically identifies your street and coordinates with 1 tap.</span>
                </div>
              </div>
            </div>

            {/* Manual fallback toggle */}
            {!showManualSearch ? (
              <button 
                type="button" 
                className="loc-manual-link" 
                onClick={() => setShowManualSearch(true)}
              >
                🔍 Or set your city manually (Indore, Bhopal, Vadodara, etc.)
              </button>
            ) : (
              <div className="loc-manual-search-box">
                <div className="manual-search-input-wrap">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search city, area or street..."
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    autoFocus
                  />
                  {isSearching && <span className="search-spinner">↻</span>}
                </div>
                {searchResults.length > 0 && (
                  <ul className="manual-search-results">
                    {searchResults.map((item, idx) => (
                      <li key={idx} onClick={() => handleSelectManual(item)}>
                        <MapPin size={14} className="result-pin" />
                        <span>{item.displayName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="loc-modal-actions">
              <Button 
                variant="outline" 
                size="md" 
                onClick={handleDismiss}
                className="loc-btn-skip"
              >
                Skip for Now
              </Button>
              <Button 
                variant="primary" 
                size="md" 
                onClick={handleRequestLocation}
                className="loc-btn-primary"
              >
                <MapPin size={18} />
                <span>Allow Location Access</span>
              </Button>
            </div>
            <span className="loc-privacy-note">
              🔒 Location is only checked during active sessions. Exact coordinates are never shared publicly.
            </span>
          </div>
        )}

        {/* STEP 2: LOCATING IN PROGRESS */}
        {step === 'locating' && (
          <div className="loc-modal-body loc-locating-body">
            <div className="loc-radar-container active-locating">
              <div className="loc-radar-ring ring-1 pulse"></div>
              <div className="loc-radar-ring ring-2 pulse delay-1"></div>
              <div className="loc-radar-ring ring-3 pulse delay-2"></div>
              <div className="loc-radar-icon locating">
                <Navigation size={32} className="loc-spinning-nav" />
              </div>
            </div>

            <h2 className="loc-modal-title">Accessing Your Location…</h2>
            <p className="loc-modal-desc">
              Requesting GPS coordinates from your device and resolving your city via OpenStreetMap. Please allow the prompt in your browser if requested.
            </p>

            <div className="loc-progress-bar-container">
              <div className="loc-progress-bar-fill"></div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div className="loc-modal-body loc-success-body">
            <div className="loc-success-icon-wrap">
              <CheckCircle2 size={56} className="loc-success-icon" />
            </div>

            <h2 className="loc-modal-title">Location Acquired!</h2>
            <p className="loc-modal-desc">
              Your session is now linked to your real-time location.
            </p>

            {acquiredDetails && (
              <div className="loc-acquired-pill">
                <MapPin size={16} />
                <span className="acquired-name">{acquiredDetails.locality}</span>
                <span className="acquired-coords">
                  ({acquiredDetails.lat.toFixed(4)}, {acquiredDetails.lng.toFixed(4)})
                </span>
              </div>
            )}

            <div className="loc-modal-actions">
              <Button 
                variant="primary" 
                size="md" 
                onClick={handleDismiss}
                className="loc-btn-primary"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: DENIED / ERROR WITH MANUAL SEARCH FALLBACK */}
        {step === 'denied' && (
          <div className="loc-modal-body loc-denied-body">
            <div className="loc-error-icon-wrap">
              <AlertTriangle size={48} className="loc-error-icon" />
            </div>

            <h2 className="loc-modal-title">Location Access Needed</h2>
            <p className="loc-modal-desc">
              {errorMessage || 'Browser location permission was not granted. You can search and pick your city manually below.'}
            </p>

            {/* Manual Search Fallback Box */}
            <div className="loc-manual-search-box full-box">
              <label className="manual-label">Choose your active city / neighborhood:</label>
              <div className="manual-search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="e.g. Indore, Vijay Nagar, Bhopal, Vadodara..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  autoFocus
                />
                {isSearching && <span className="search-spinner">↻</span>}
              </div>
              {searchResults.length > 0 && (
                <ul className="manual-search-results">
                  {searchResults.map((item, idx) => (
                    <li key={idx} onClick={() => handleSelectManual(item)}>
                      <MapPin size={14} className="result-pin" />
                      <span>{item.displayName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="loc-modal-actions">
              <Button 
                variant="outline" 
                size="md" 
                onClick={handleRequestLocation}
                className="loc-btn-retry"
              >
                <RotateCcw size={16} />
                <span>Try GPS Again</span>
              </Button>
              <Button 
                variant="primary" 
                size="md" 
                onClick={handleDismiss}
                className="loc-btn-primary"
              >
                <span>Use Default (Indore)</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
