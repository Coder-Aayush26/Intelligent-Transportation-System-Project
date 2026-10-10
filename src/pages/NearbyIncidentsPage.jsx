import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNearbyIncidents } from '../api/incidents';
import { CATEGORY_STYLES } from '../data/mockData';
import './NearbyIncidentsPage.css';

export default function NearbyIncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const navigate = useNavigate();

  const handleFindNearby = () => {
    setLocating(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        setLoading(true);
        try {
          const data = await fetchNearbyIncidents(pos.coords.latitude, pos.coords.longitude, 10);
          setIncidents(data);
        } catch (err) {
          setError("Failed to fetch nearby incidents from the server.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError("Unable to retrieve your location. Please check browser permissions.");
        setLocating(false);
      }
    );
  };

  // Automatically request on mount
  useEffect(() => {
    handleFindNearby();
  }, []);

  return (
    <div className="nearby-page">
      <div className="page-header">
        <h2>Nearby Incidents</h2>
        <p>Active traffic disruptions within a 10km radius of your current location.</p>
        <button 
          className="btn-refresh" 
          onClick={handleFindNearby} 
          disabled={locating || loading}
        >
          {locating ? 'Locating...' : loading ? 'Fetching...' : '↻ Refresh Location'}
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}

      {loading || locating ? (
        <div className="loading-state">Scanning your area...</div>
      ) : incidents.length === 0 && !error ? (
        <div className="empty-state">
          <h3>✅ All clear!</h3>
          <p>We couldn't find any active incidents within 10km of your location.</p>
        </div>
      ) : (
        <div className="nearby-grid">
          {incidents.map((inc) => {
            const style = CATEGORY_STYLES[inc.category] ?? CATEGORY_STYLES.Other;
            return (
              <div 
                key={inc.id} 
                className="nearby-card"
                onClick={() => navigate(`/app/incidents/${inc.id}`)}
              >
                <div className="nearby-card-header">
                  <div className="nearby-icon" style={{ backgroundColor: style.color }}>
                    {style.icon}
                  </div>
                  <div>
                    <h4>{inc.category}</h4>
                    <span className="nearby-severity severity-{inc.severity.toLowerCase()}">{inc.severity} Severity</span>
                  </div>
                </div>
                <div className="nearby-card-body">
                  <p className="nearby-loc">📍 {inc.fullLocation}</p>
                  <p className="nearby-desc">{inc.description}</p>
                </div>
                <div className="nearby-card-footer">
                  <span>Reported {inc.reportedAt}</span>
                  <span className="conf">Conf: {inc.confidence}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
