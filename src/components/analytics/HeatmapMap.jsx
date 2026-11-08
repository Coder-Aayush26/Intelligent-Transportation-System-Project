import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { HeatLayer } from 'leaflet.heat';
import { Layers, Sliders, AlertTriangle, Navigation, MapPin } from 'lucide-react';
import { useAppLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import './HeatmapMap.css';

/**
 * Controller to smoothly animate the map when a specific corridor is clicked,
 * or automatically fly to the user's current GPS location on page load.
 */
function MapFlyController({ target, zoom = 14, duration = 1.4 }) {
  const map = useMap();
  useEffect(() => {
    if (target && target[0] && target[1]) {
      map.flyTo(target, zoom, { duration });
    }
  }, [target, zoom, duration, map]);
  return null;
}

/**
 * Controller that monitors user location and automatically navigates the map
 * to the user's coordinates on initial load.
 */
function AutoUserLocationController({ userCoords, focusedLocation, zoom = 14 }) {
  const map = useMap();
  const hasAutoCenteredRef = useRef(false);

  useEffect(() => {
    // If user clicked a corridor, let focusedLocation take over
    if (focusedLocation && focusedLocation[0] && focusedLocation[1]) {
      return;
    }

    // Automatically navigate to user's location as soon as it becomes available
    if (userCoords && userCoords[0] && userCoords[1] && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      map.flyTo(userCoords, zoom, { duration: 1.5 });
    }
  }, [userCoords, focusedLocation, zoom, map]);

  return null;
}

/**
 * HeatLayer subcomponent using official leaflet.heat integration.
 */
function HeatLayerComponent({ points = [], radius = 25, blur = 18, max = 1.0, isVisible = true }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !isVisible || !points || points.length === 0) return;

    // Filter points to ensure validity
    const validPoints = points.filter(
      (p) => Array.isArray(p) && !isNaN(p[0]) && !isNaN(p[1]) && p[0] !== 0
    );
    if (validPoints.length === 0) return;

    const heat = new HeatLayer(validPoints, {
      radius: Number(radius),
      blur: Number(blur),
      max: Number(max),
      minOpacity: 0.18,
      gradient: {
        0.2: '#3b82f6',
        0.4: '#10b981',
        0.6: '#f59e0b',
        0.8: '#f97316',
        1.0: '#ef4444',
      },
    });

    map.addLayer(heat);

    return () => {
      try {
        map.removeLayer(heat);
      } catch {
        // layer already removed
      }
    };
  }, [map, points, radius, blur, max, isVisible]);

  return null;
}

function makeClusterIcon(count, severity) {
  const sevClass = `sev-${severity || 'Medium'}`;
  return L.divIcon({
    className: 'corridor-marker-icon',
    html: `<div class="cluster-marker-pin ${sevClass}" title="${count} incidents">${count}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function makeCorridorBadgeIcon(name, dangerScore) {
  return L.divIcon({
    className: 'corridor-marker-icon',
    html: `<div class="corridor-badge"><span>⚠</span> ${name} (${dangerScore})</div>`,
    iconSize: [120, 24],
    iconAnchor: [60, 12],
    popupAnchor: [0, -12],
  });
}

function makeUserLocationIcon() {
  return L.divIcon({
    className: 'user-loc-marker-icon',
    html: `
      <div class="user-gps-pulse-wrap" title="Your Current Location">
        <div class="user-gps-radar-ring"></div>
        <div class="user-gps-radar-ring outer"></div>
        <div class="user-gps-dot">📍</div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

export default function HeatmapMap({
  heatmapPoints = [],
  corridors = [],
  clusters = [],
  focusedLocation = null,
}) {
  const { deviceLocation, selectedLocation, requestDeviceLocation, isLocating } = useAppLocation();
  const { user } = useAuth();

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCorridors, setShowCorridors] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [radius, setRadius] = useState(28);
  const [blur, setBlur] = useState(18);
  const [tileMode, setTileMode] = useState('dark'); // 'dark' | 'streets'
  const [flyTarget, setFlyTarget] = useState(null);

  // Compute current user GPS coordinates
  const currentUserCoords = useMemo(() => {
    if (deviceLocation?.lat != null && deviceLocation?.lng != null) {
      return [deviceLocation.lat, deviceLocation.lng];
    }
    if (selectedLocation?.lat != null && selectedLocation?.lng != null) {
      return [selectedLocation.lat, selectedLocation.lng];
    }
    const userLat = user?.latitude ?? user?.lat;
    const userLng = user?.longitude ?? user?.lng;
    if (userLat != null && userLng != null) {
      return [Number(userLat), Number(userLng)];
    }
    return null;
  }, [deviceLocation, selectedLocation, user]);

  // If GPS is not acquired, request it automatically on mount
  useEffect(() => {
    if (!currentUserCoords && requestDeviceLocation) {
      requestDeviceLocation(false);
    }
  }, [currentUserCoords, requestDeviceLocation]);

  // OpenStreetMap is 100% free and requires no API key.
  // Dark mode is achieved via high-contrast CSS tile filter.
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Center defaults to user's location if available, otherwise Indore center
  const defaultCenter = currentUserCoords || [22.7196, 75.8577];

  const handleLocateMe = () => {
    if (currentUserCoords) {
      setFlyTarget({ coords: currentUserCoords, key: Date.now() });
    } else if (requestDeviceLocation) {
      requestDeviceLocation(true);
    }
  };

  return (
    <div className={`heatmap-map-container ${tileMode === 'dark' ? 'dark-tiles' : ''}`}>
      {/* Floating Controls Overlay */}
      <div className="heatmap-controls-panel">
        <div className="ctrl-title">
          <span>GIS Heatmap Controls</span>
          <Layers size={14} />
        </div>

        {/* Locate User Action Button */}
        <button
          type="button"
          className="btn-locate-user"
          onClick={handleLocateMe}
          title="Center map on your current GPS location"
        >
          <Navigation size={14} />
          <span>{isLocating ? 'Acquiring GPS…' : currentUserCoords ? 'Center on My Location' : 'Detect My Location'}</span>
        </button>

        <div className="ctrl-toggles-grid">
          <label className="ctrl-toggle-label">
            <span>Heatmap Overlay</span>
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
            />
          </label>
          <label className="ctrl-toggle-label">
            <span>Hotspot Corridors</span>
            <input
              type="checkbox"
              checked={showCorridors}
              onChange={(e) => setShowCorridors(e.target.checked)}
            />
          </label>
          <label className="ctrl-toggle-label">
            <span>Incident Clusters</span>
            <input
              type="checkbox"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
            />
          </label>
        </div>

        <div className="ctrl-slider-group">
          <div className="slider-label-row">
            <span>Heat Radius</span>
            <span>{radius}px</span>
          </div>
          <input
            type="range"
            min="12"
            max="45"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </div>

        <div className="ctrl-slider-group">
          <div className="slider-label-row">
            <span>Blur Spread</span>
            <span>{blur}px</span>
          </div>
          <input
            type="range"
            min="8"
            max="30"
            value={blur}
            onChange={(e) => setBlur(Number(e.target.value))}
          />
        </div>

        <label className="ctrl-toggle-label" style={{ marginTop: '4px' }}>
          <span>High-Contrast Basemap</span>
          <input
            type="checkbox"
            checked={tileMode === 'dark'}
            onChange={(e) => setTileMode(e.target.checked ? 'dark' : 'streets')}
          />
        </label>
      </div>

      {/* Map Legend */}
      <div className="heatmap-legend-box">
        <div style={{ fontWeight: 600 }}>Hazard Intensity</div>
        <div className="gradient-bar" />
        <div className="gradient-labels">
          <span>Low</span>
          <span>Medium</span>
          <span>Critical</span>
        </div>
      </div>

      <MapContainer center={defaultCenter} zoom={13} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />

        {/* Automatic navigation to user's GPS coordinates */}
        <AutoUserLocationController
          userCoords={currentUserCoords}
          focusedLocation={focusedLocation}
          zoom={14}
        />

        {/* Manual fly-to controller for corridor focus */}
        {focusedLocation && <MapFlyController target={focusedLocation} zoom={14} />}

        {/* Manual fly-to controller for Locate Me button */}
        {flyTarget && <MapFlyController target={flyTarget.coords} zoom={14} />}

        {/* Current User Location Marker with Pulsing Radar Ring */}
        {currentUserCoords && (
          <Marker position={currentUserCoords} icon={makeUserLocationIcon()}>
            <Popup>
              <div style={{ padding: '6px', color: '#1e293b' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 800, color: '#1d4ed8' }}>
                  📍 Your Current Location
                </h4>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  {deviceLocation?.locality || 'Indore Region'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Heatmap density and high-risk corridors are displayed relative to you.
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Heatmap Layer */}
        <HeatLayerComponent
          points={heatmapPoints}
          radius={radius}
          blur={blur}
          max={1.0}
          isVisible={showHeatmap}
        />

        {/* Corridors Polylines */}
        {showCorridors &&
          corridors.map((corr) => {
            const lineColor =
              corr.danger_score >= 80 ? '#ef4444' : corr.danger_score >= 60 ? '#f97316' : '#eab308';
            return (
              <div key={corr.id}>
                <Polyline
                  positions={corr.coordinates}
                  pathOptions={{
                    color: lineColor,
                    weight: 6,
                    opacity: 0.85,
                    dashArray: corr.active_incidents > 0 ? undefined : '6, 6',
                  }}
                >
                  <Popup>
                    <div style={{ padding: '6px', color: '#1e293b' }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700 }}>
                        {corr.name}
                      </h4>
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <strong>Danger Index:</strong> {corr.danger_score}/100 ({corr.danger_level})
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <strong>Dominant Hazard:</strong> {corr.primary_hazard}
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                        <strong>Recent Incidents:</strong> {corr.incident_count} ({corr.active_incidents} active)
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          background: '#f8fafc',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          borderLeft: '3px solid #3b82f6',
                        }}
                      >
                        <strong>Municipal Rec:</strong> {corr.recommendation}
                      </div>
                    </div>
                  </Popup>
                </Polyline>

                {corr.center && (
                  <Marker
                    position={corr.center}
                    icon={makeCorridorBadgeIcon(corr.name, corr.danger_score)}
                  />
                )}
              </div>
            );
          })}

        {/* Cluster Markers */}
        {showClusters &&
          clusters.map((cl) => (
            <Marker
              key={cl.id}
              position={cl.center}
              icon={makeClusterIcon(cl.count, cl.highest_severity)}
            >
              <Popup>
                <div style={{ padding: '4px', color: '#1e293b' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '13px' }}>{cl.location_label}</h4>
                  <div style={{ fontSize: '12px' }}>
                    <strong>{cl.count}</strong> clustered incidents
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Dominant: {cl.dominant_category}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
