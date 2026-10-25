import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus, Navigation } from 'lucide-react';
import { mapLegend, CATEGORY_STYLES } from '../../data/mockData';
import { useAppLocation } from '../../context/LocationContext';
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

/** User device location marker — blue pulsing dot */
const USER_ICON = L.divIcon({
  className: '',
  html: `<div class="user-location-pin" title="Your device location"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Searched custom location marker — purple pinpoint */
const SEARCHED_ICON = L.divIcon({
  className: '',
  html: `<div class="searched-location-pin" title="Searched location"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

/**
 * Controller inside MapContainer to smoothly navigate the map when
 * coordinates change (e.g. searching "vadodara" or acquiring device GPS).
 */
function MapController({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

/** Custom on-map zoom buttons */
function MapControls() {
  const map = useMap();
  return (
    <div className="map-controls">
      <button
        type="button"
        className="map-ctrl-btn"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={16} />
      </button>
      <button
        type="button"
        className="map-ctrl-btn"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}

export default function LiveMap({ 
  incidents = [], 
  loading = false, 
  activeCategories = null,
  onToggleCategory = null 
}) {
  const navigate = useNavigate();
  const { 
    selectedLocation, 
    deviceLocation, 
    resetToDeviceLocation 
  } = useAppLocation();

  // Local category filter state if not controlled externally
  const [localCategories, setLocalCategories] = useState(() => {
    const initial = {};
    mapLegend.forEach((item) => { initial[item.label] = true; });
    return initial;
  });

  const categories = activeCategories || localCategories;

  const handleCategoryToggle = (label) => {
    if (onToggleCategory) {
      onToggleCategory(label);
    } else {
      setLocalCategories((prev) => ({
        ...prev,
        [label]: !prev[label],
      }));
    }
  };

  const centerCoord = [selectedLocation.lat, selectedLocation.lng];

  // Filter incidents by enabled categories and ensure valid coordinates
  const visibleIncidents = incidents.filter((inc) => {
    const lat = inc.coords?.lat;
    const lng = inc.coords?.lng;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
    // Check if category is enabled
    const cat = inc.category || 'Other';
    if (categories[cat] === false) return false;
    return true;
  });

  return (
    <div className="map-card">
      <div className="map-canvas">
        {loading && (
          <div className="map-loading-overlay">Loading incidents…</div>
        )}

        {/* Floating chip when viewing a custom searched location */}
        {selectedLocation.isCustom && (
          <div className="map-floating-chip">
            <span>📍 Viewing: <b>{selectedLocation.label}</b></span>
            {deviceLocation && (
              <button
                type="button"
                className="map-return-btn"
                onClick={resetToDeviceLocation}
                title="Return to your GPS device location"
              >
                Return to My Location
              </button>
            )}
          </div>
        )}

        <MapContainer
          center={centerCoord}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Dynamic map center controller */}
          <MapController center={centerCoord} zoom={13} />

          {/* Map zoom controls */}
          <MapControls />

          {/* Device location pin and accuracy circle if available */}
          {deviceLocation && (
            <>
              <Marker
                position={[deviceLocation.lat, deviceLocation.lng]}
                icon={USER_ICON}
              >
                <Popup>
                  <div className="osm-popup">
                    <strong>📍 Your Device Location</strong>
                    <p>{deviceLocation.locality || 'Current location acquired via browser GPS'}</p>
                  </div>
                </Popup>
              </Marker>
              {deviceLocation.accuracy > 0 && deviceLocation.accuracy <= 2000 && (
                <Circle
                  center={[deviceLocation.lat, deviceLocation.lng]}
                  radius={deviceLocation.accuracy}
                  pathOptions={{
                    color: '#2563eb',
                    fillColor: '#2563eb',
                    fillOpacity: 0.08,
                    weight: 1,
                  }}
                />
              )}
            </>
          )}

          {/* Searched location marker when inspecting a searched place */}
          {selectedLocation.isCustom && (
            <Marker position={centerCoord} icon={SEARCHED_ICON}>
              <Popup>
                <div className="osm-popup">
                  <strong>📍 Searched Location</strong>
                  <p>{selectedLocation.label}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Incident Pins */}
          {visibleIncidents.map((incident) => {
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
                    <p>{incident.fullLocation || incident.location}</p>
                    {incident.description && (
                      <p style={{ fontStyle: 'italic', color: '#555' }}>
                        "{incident.description}"
                      </p>
                    )}
                    <p className="osm-popup-meta">
                      Severity: <b>{incident.severity}</b> &nbsp;|&nbsp; Conf: <b>{incident.confidence}%</b>
                    </p>
                    <button
                      type="button"
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

      {/* ── Interactive Category Filter Legend ── */}
      <div className="map-legend">
        {mapLegend.map((item) => {
          const isEnabled = categories[item.label] !== false;
          return (
            <button
              type="button"
              key={item.label}
              className={`leg-item ${!isEnabled ? 'inactive' : ''}`}
              onClick={() => handleCategoryToggle(item.label)}
              title={`Click to ${isEnabled ? 'hide' : 'show'} ${item.label} incidents`}
            >
              <span
                className="leg-check"
                style={{ background: isEnabled ? item.color : '#94a3b8' }}
              >
                {isEnabled ? '✓' : '✕'}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
