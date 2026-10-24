import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapLegend, CATEGORY_STYLES } from '../../data/mockData';
import './LiveMap.css';

// Fix Leaflet's default icon broken paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Creates a coloured circle icon for each incident category */
function makePinIcon(color, icon) {
  return L.divIcon({
    className: '',
    html: `<div class="osm-pin" style="background:${color}">${icon}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

/** Keeps the map centred when incidents first load */
function FitBounds({ incidents }) {
  const map = useMap();
  if (incidents.length === 0) return null;
  const points = incidents.map((inc) => [inc.coords.lat, inc.coords.lng]);
  map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
  return null;
}

// Default centre — Indore, MP (matches mock data)
const DEFAULT_CENTER = [22.7196, 75.8577];

export default function LiveMap({ incidents = [], loading = false }) {
  const navigate = useNavigate();

  return (
    <div className="map-card">
      <div className="map-canvas">
        {loading && (
          <div className="map-loading-overlay">Loading incidents…</div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {incidents.length > 0 && <FitBounds incidents={incidents} />}

          {incidents.map((incident) => {
            const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
            return (
              <Marker
                key={incident.id}
                position={[incident.coords.lat, incident.coords.lng]}
                icon={makePinIcon(style.color, style.icon)}
              >
                <Popup>
                  <div className="osm-popup">
                    <strong>{style.icon} {incident.category}</strong>
                    <p>{incident.location}</p>
                    <p className="osm-popup-meta">
                      Severity: <b>{incident.severity}</b> &nbsp;|&nbsp; Conf: <b>{incident.confidence}%</b>
                    </p>
                    <button
                      className="osm-popup-link"
                      onClick={() => navigate(`/app/incidents/${incident.id}`)}
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

      <div className="map-legend">
        {mapLegend.map((item) => (
          <span className="leg-item" key={item.label}>
            <span className="leg-check" style={{ background: item.color }}>✓</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
