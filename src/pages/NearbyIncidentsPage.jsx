import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchNearbyIncidents } from '../api/incidents';
import { CATEGORY_STYLES } from '../data/mockData';
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
  html: `<div class="user-location-pin"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ userPos, incidents }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    if (userPos) pts.push([userPos.lat, userPos.lng]);
    incidents.forEach((inc) => pts.push([inc.coords.lat, inc.coords.lng]));
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }, [userPos, incidents, map]);
  return null;
}

export default function NearbyIncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const navigate = useNavigate();

  const handleFindNearby = () => {
    setLocating(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        setLocating(false);
        setLoading(true);
        try {
          const data = await fetchNearbyIncidents(latitude, longitude, 10);
          setIncidents(data);
        } catch (err) {
          setError('Failed to fetch nearby incidents from the server.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError('Unable to retrieve your location. Please check browser permissions.');
        setLocating(false);
      }
    );
  };

  useEffect(() => {
    handleFindNearby();
  }, []);

  return (
    <div className="nearby-page">
      <div className="page-header">
        <h2>Nearby Incidents</h2>
        <p>Active traffic disruptions within a 10 km radius of your current location.</p>
        <button
          className="btn-refresh"
          onClick={handleFindNearby}
          disabled={locating || loading}
        >
          {locating ? 'Locating...' : loading ? 'Fetching...' : '↻ Refresh Location'}
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}

      {/* ── OSM Map ── */}
      <div className="nearby-map-wrap">
        <MapContainer
          center={userPos ? [userPos.lat, userPos.lng] : [22.7196, 75.8577]}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <FitBounds userPos={userPos} incidents={incidents} />

          {/* User location */}
          {userPos && (
            <>
              <Marker position={[userPos.lat, userPos.lng]} icon={USER_ICON}>
                <Popup>📍 Your location</Popup>
              </Marker>
              <Circle
                center={[userPos.lat, userPos.lng]}
                radius={10000}
                pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.05, weight: 1.5, dashArray: '6 4' }}
              />
            </>
          )}

          {/* Incident pins */}
          {incidents.map((inc) => {
            const style = CATEGORY_STYLES[inc.category] ?? CATEGORY_STYLES.Other;
            return (
              <Marker
                key={inc.id}
                position={[inc.coords.lat, inc.coords.lng]}
                icon={makePinIcon(style.color, style.icon)}
              >
                <Popup>
                  <div className="osm-popup">
                    <strong>{style.icon} {inc.category}</strong>
                    <p>{inc.fullLocation}</p>
                    <p className="osm-popup-meta">
                      Severity: <b>{inc.severity}</b> &nbsp;|&nbsp; Conf: <b>{inc.confidence}%</b>
                    </p>
                    <button
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
      {loading || locating ? (
        <div className="loading-state">Scanning your area...</div>
      ) : incidents.length === 0 && !error ? (
        <div className="empty-state">
          <h3>✅ All clear!</h3>
          <p>We couldn't find any active incidents within 10 km of your location.</p>
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
                    <span className={`nearby-severity severity-${inc.severity.toLowerCase()}`}>
                      {inc.severity} Severity
                    </span>
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
