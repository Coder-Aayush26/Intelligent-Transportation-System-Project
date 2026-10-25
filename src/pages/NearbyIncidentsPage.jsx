import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchNearbyIncidents } from '../api/incidents';
import { CATEGORY_STYLES } from '../data/mockData';
import { useAppLocation } from '../context/LocationContext';
import './NearbyIncidentsPage.css';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePinIcon(color, icon) {
  return L.divIcon({
    className: '',
    html: `<div class="osm-pin" style="background:${color}">${icon}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

/** User location marker — blue pulsing dot */
const USER_ICON = L.divIcon({
  className: '',
  html: `<div class="user-location-pin" title="Your location"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Custom searched location marker */
const SEARCHED_ICON = L.divIcon({
  className: '',
  html: `<div class="searched-location-pin" title="Searched location"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

/** Keeps the map smoothly updated when coordinates change */
function MapController({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function NearbyIncidentsPage() {
  const navigate = useNavigate();
  const {
    selectedLocation,
    deviceLocation,
    isLocating,
    requestDeviceLocation,
    resetToDeviceLocation,
  } = useAppLocation();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeLat = selectedLocation.lat;
  const activeLng = selectedLocation.lng;
  const isCustomLoc = selectedLocation.isCustom;

  const loadIncidents = useCallback(async (lat, lng) => {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchNearbyIncidents(lat, lng, 10);
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to fetch nearby incidents from the server.');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch incidents whenever active coordinates change
  useEffect(() => {
    loadIncidents(activeLat, activeLng);
  }, [loadIncidents, activeLat, activeLng]);

  const handleRefreshLocation = () => {
    requestDeviceLocation(true);
  };

  const centerCoord = [activeLat, activeLng];

  return (
    <div className="nearby-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Nearby Incidents</h2>
            <p>
              Active traffic disruptions within a 10 km radius of{' '}
              <b>{isCustomLoc ? selectedLocation.label : (deviceLocation?.locality || 'your location')}</b>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCustomLoc && deviceLocation && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={resetToDeviceLocation}
                style={{ padding: '8px 14px' }}
              >
                📍 Use My Location
              </button>
            )}
            <button
              type="button"
              className="btn-refresh"
              onClick={handleRefreshLocation}
              disabled={isLocating || loading}
            >
              {isLocating ? 'Locating…' : loading ? 'Fetching…' : '↻ Refresh Location'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-state" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadIncidents(activeLat, activeLng)}
            style={{
              background: 'none',
              border: '1px solid currentColor',
              borderRadius: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
            }}
          >
            ↻ Retry
          </button>
        </div>
      )}

      {/* ── OSM Map ── */}
      <div className="nearby-map-wrap">
        <MapContainer
          center={centerCoord}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapController center={centerCoord} zoom={13} />

          {/* User location marker or Searched center marker */}
          <Marker
            position={centerCoord}
            icon={isCustomLoc ? SEARCHED_ICON : USER_ICON}
          >
            <Popup>
              <strong>{isCustomLoc ? '📍 Selected Search Area' : '📍 Your Location'}</strong>
              <p>{selectedLocation.label}</p>
            </Popup>
          </Marker>

          {/* 10 km radius circle around the active query coordinates */}
          <Circle
            center={centerCoord}
            radius={10000}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#2563eb',
              fillOpacity: 0.05,
              weight: 1.5,
              dashArray: '6 4',
            }}
          />

          {/* Incident pins */}
          {incidents.map((inc) => {
            const style = CATEGORY_STYLES[inc.category] ?? CATEGORY_STYLES.Other;
            if (inc.coords?.lat == null || inc.coords?.lng == null) return null;

            return (
              <Marker
                key={inc.id}
                position={[inc.coords.lat, inc.coords.lng]}
                icon={makePinIcon(style.color, style.icon)}
              >
                <Popup>
                  <div className="osm-popup">
                    <strong>{style.icon} {inc.category}</strong>
                    <p>{inc.fullLocation || inc.location}</p>
                    <p className="osm-popup-meta">
                      Severity: <b>{inc.severity}</b> &nbsp;|&nbsp; Conf: <b>{inc.confidence}%</b>
                    </p>
                    <button
                      type="button"
                      className="osm-popup-link"
                      onClick={() => navigate(`/app/incidents/${inc.id}`)}
                    >
                      View Details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ── Incident cards ── */}
      {incidents.length === 0 && !loading && !isLocating && !error ? (
        <div className="empty-state">
          <h3>✅ All clear!</h3>
          <p>
            We couldn't find any active incidents within 10 km of{' '}
            {isCustomLoc ? selectedLocation.label : 'your current location'}.
          </p>
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
                    <span className={`nearby-severity severity-${(inc.severity || 'medium').toLowerCase()}`}>
                      {inc.severity} Severity
                    </span>
                  </div>
                </div>
                <div className="nearby-card-body">
                  <p className="nearby-loc">📍 {inc.fullLocation || inc.location}</p>
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
