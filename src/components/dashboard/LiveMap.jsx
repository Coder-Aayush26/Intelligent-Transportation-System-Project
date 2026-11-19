import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Plus, Minus, Eye, EyeOff, Filter, RotateCcw, X, Check, Route, Maximize2, Edit3
} from 'lucide-react';
import { mapLegend, CATEGORY_STYLES } from '../../data/mockData';
import { useAppLocation } from '../../context/LocationContext';
import { verifyIncident } from '../../api/incidents';
import { getFavoriteRoutes, getRoutePolyline, subscribeFavorites } from '../../services/favoritesStorage';
import AddFavoriteModal from '../common/AddFavoriteModal';
import './LiveMap.css';

// Fix Leaflet's default icon broken paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Cache for category pin icons to prevent expensive Leaflet DOM/icon reallocations on render */
const PIN_ICON_CACHE = new Map();

function makePinIcon(color, icon) {
  const key = `${color}_${icon}`;
  if (!PIN_ICON_CACHE.has(key)) {
    PIN_ICON_CACHE.set(
      key,
      L.divIcon({
        className: '',
        html: `<div class="osm-pin" style="background:${color}">${icon}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })
    );
  }
  return PIN_ICON_CACHE.get(key);
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

/** Route Origin Pin (A) */
const ROUTE_START_ICON = L.divIcon({
  className: '',
  html: `<div class="route-endpoint-pin start" title="Route Origin (Point A)">A</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14],
});

/** Route Destination Pin (B) */
const ROUTE_END_ICON = L.divIcon({
  className: '',
  html: `<div class="route-endpoint-pin end" title="Route Destination (Point B)">B</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14],
});

/**
 * Controller inside MapContainer to smoothly navigate the map when
 * coordinates change (e.g. searching "vadodara" or acquiring device GPS).
 *
 * NOTE: When disabled (e.g. while inspecting a favorite route), it avoids
 * calling map.flyTo so that continuous device GPS updates do not snap the user away.
 */
function MapController({ center, zoom = 13, disabled = false }) {
  const map = useMap();
  const prevCenterRef = useRef(null);

  useEffect(() => {
    if (disabled) return;
    if (!center || isNaN(center[0]) || isNaN(center[1])) return;

    const prev = prevCenterRef.current;
    if (!prev || Math.abs(prev[0] - center[0]) > 0.0001 || Math.abs(prev[1] - center[1]) > 0.0001) {
      prevCenterRef.current = center;
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center, zoom, map, disabled]);

  return null;
}

/**
 * Controller to automatically frame and fit the bounds of an inspected route.
 * Crucial fix: Frames the bounds ONCE per route selection so user can freely
 * zoom and pan without the camera fighting them.
 */
function RouteBoundsController({ routePoints, routeId }) {
  const map = useMap();
  const framedRouteIdRef = useRef(null);

  useEffect(() => {
    if (!routeId || !routePoints || routePoints.length < 2) return;
    if (framedRouteIdRef.current === routeId) return;
    framedRouteIdRef.current = routeId;

    try {
      const bounds = L.latLngBounds(routePoints);
      map.fitBounds(bounds, { padding: [65, 65], maxZoom: 15, duration: 1.0 });
    } catch {
      // ignore
    }
  }, [routePoints, routeId, map]);

  return null;
}

/** Bridge component inside MapContainer to capture the Leaflet map instance safely */
function MapInstanceBridge({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (map) onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

/** Distance calculation between two points in metres (Haversine formula). */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SEVERITY_OPTIONS = ['All', 'Critical', 'High', 'Medium', 'Low'];

export default function LiveMap({ 
  incidents = [], 
  loading = false, 
  activeCategories = null,
  onToggleCategory = null,
  onResetCategories = null,
  activeSeverity = 'All',
  onSelectSeverity = null,
  incidentsVisible: controlledIncidentsVisible = null,
  onToggleIncidentsVisible = null,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParam = searchParams.get('route');

  const { 
    selectedLocation, 
    deviceLocation, 
    resetToDeviceLocation 
  } = useAppLocation();

  // Reference to Leaflet map instance captured from inside MapContainer
  const [mapInstance, setMapInstance] = useState(null);

  // Quick verification votes cast from map popups
  const [popupVotes, setPopupVotes] = useState({});

  // Inspected Route Polyline & Details State
  const [inspectedRoute, setInspectedRoute] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [loadingRouteGeometry, setLoadingRouteGeometry] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const syncRoute = () => {
      if (!routeParam) {
        setInspectedRoute(null);
        setRoutePolyline([]);
        return;
      }

      const allRoutes = getFavoriteRoutes();
      const found = allRoutes.find((r) => r.id === routeParam);
      if (found && found.fromCoords && found.toCoords) {
        setInspectedRoute(found);
        setLoadingRouteGeometry(true);
        getRoutePolyline(found.fromCoords, found.toCoords)
          .then((pts) => {
            if (isCurrent) {
              setRoutePolyline(pts);
              setLoadingRouteGeometry(false);
            }
          })
          .catch(() => {
            if (isCurrent) setLoadingRouteGeometry(false);
          });
      } else {
        setInspectedRoute(null);
        setRoutePolyline([]);
      }
    };

    syncRoute();
    const unsub = subscribeFavorites(syncRoute);
    return () => {
      isCurrent = false;
      unsub();
    };
  }, [routeParam]);

  const handleClearInspectedRoute = () => {
    setInspectedRoute(null);
    setRoutePolyline([]);
    setSearchParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.delete('route');
      return copy;
    });
  };

  const handleRefitRoute = () => {
    if (mapInstance && routePolyline.length >= 2) {
      try {
        const bounds = L.latLngBounds(routePolyline);
        mapInstance.fitBounds(bounds, { padding: [65, 65], maxZoom: 15, duration: 0.8 });
      } catch {
        // ignore
      }
    }
  };

  const handleQuickVerify = async (e, incidentId, verdict, userCoord = null) => {
    e.stopPropagation();
    setPopupVotes((prev) => ({ ...prev, [incidentId]: verdict }));
    try {
      localStorage.setItem(`its_vote_${incidentId}`, verdict);
    } catch {
      // ignore
    }
    try {
      await verifyIncident(incidentId, verdict, userCoord);
    } catch (err) {
      console.warn('Quick verify sync:', err);
    }
  };

  // Show/Hide markers state (local fallback if not controlled)
  const [localIncidentsVisible, setLocalIncidentsVisible] = useState(true);
  const incidentsVisible = controlledIncidentsVisible ?? localIncidentsVisible;

  // Filter drawer/panel visibility inside the map
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef(null);

  // Local category filter state if not controlled externally
  const [localCategories, setLocalCategories] = useState(() => {
    const initial = {};
    mapLegend.forEach((item) => { initial[item.label] = true; });
    return initial;
  });

  const [localSeverity, setLocalSeverity] = useState('All');
  const severityFilter = onSelectSeverity ? activeSeverity : localSeverity;

  const categories = activeCategories || localCategories;

  // Listen to external toggle events from Topbar Filters button
  useEffect(() => {
    const handleToggleFilters = () => {
      setIsFilterPanelOpen((prev) => !prev);
    };
    window.addEventListener('its-toggle-map-filters', handleToggleFilters);
    return () => {
      window.removeEventListener('its-toggle-map-filters', handleToggleFilters);
    };
  }, []);

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

  const handleResetFilters = () => {
    if (onResetCategories) {
      onResetCategories();
    } else {
      const allActive = {};
      mapLegend.forEach((item) => { allActive[item.label] = true; });
      setLocalCategories(allActive);
    }
    if (onSelectSeverity) {
      onSelectSeverity('All');
    } else {
      setLocalSeverity('All');
    }
  };

  const handleToggleVisibility = () => {
    if (onToggleIncidentsVisible) {
      onToggleIncidentsVisible(!incidentsVisible);
    } else {
      setLocalIncidentsVisible((prev) => !prev);
    }
  };

  const centerCoord = [selectedLocation.lat, selectedLocation.lng];

  // Count active categories
  const activeCategoryCount = useMemo(() => {
    return Object.values(categories).filter(Boolean).length;
  }, [categories]);

  const hasFilterActive = activeCategoryCount < mapLegend.length || severityFilter !== 'All';

  // Filter incidents by visibility, category, and severity
  const visibleIncidents = useMemo(() => {
    if (!incidentsVisible) return [];
    return incidents.filter((inc) => {
      const lat = inc.coords?.lat ?? inc.lat;
      const lng = inc.coords?.lng ?? inc.lng;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;

      // Category check
      const cat = inc.category || 'Other';
      if (categories[cat] === false) return false;

      // Severity check
      if (severityFilter !== 'All') {
        const incSev = (inc.severity || 'Medium').toLowerCase();
        if (incSev !== severityFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [incidents, incidentsVisible, categories, severityFilter]);

  return (
    <div className="map-card">
      <div className="map-canvas">
        {loading && (
          <div className="map-loading-overlay">Loading incidents…</div>
        )}

        {/* ── Top-Left: Inspected Route Banner or Searched Location Badge ── */}
        {inspectedRoute ? (
          <div className="map-inspected-route-chip">
            <div className="mirc-icon">
              <Route size={16} />
            </div>
            <div className="mirc-content">
              <div className="mirc-top">
                <span className="mirc-badge">INSPECTING ROUTE</span>
                <span className="mirc-title">{inspectedRoute.name}</span>
              </div>
              <span className="mirc-sub">
                {inspectedRoute.distance ? `${inspectedRoute.distance} • ` : ''}
                {inspectedRoute.estTime ? `${inspectedRoute.estTime} • ` : ''}
                {inspectedRoute.from.split(',')[0]} ➔ {inspectedRoute.to.split(',')[0]}
                {loadingRouteGeometry ? ' (Tracing path…)' : ''}
              </span>
            </div>
            {routePolyline.length > 0 && (
              <button
                type="button"
                className="mirc-action-btn"
                onClick={handleRefitRoute}
                title="Fit full route in camera view"
              >
                <Maximize2 size={12} />
                <span>Fit Route</span>
              </button>
            )}
            <button
              type="button"
              className="mirc-action-btn"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit route starting point, destination, or mode"
            >
              <Edit3 size={12} />
              <span>Edit Route</span>
            </button>
            <button
              type="button"
              className="mirc-close-btn"
              onClick={handleClearInspectedRoute}
              title="Close route inspection view"
            >
              <X size={13} />
              <span>Clear Route</span>
            </button>
          </div>
        ) : selectedLocation.isCustom ? (
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
        ) : null}

        {/* ── Top-Right: Map Action Toolbar (Show/Hide, Filters, Zoom) ── */}
        <div className="map-top-toolbar">
          {/* Show / Hide Incidents Toggle */}
          <button
            type="button"
            className={`map-tool-btn ${!incidentsVisible ? 'tool-btn-hidden-mode' : ''}`}
            onClick={handleToggleVisibility}
            aria-label={incidentsVisible ? 'Hide incident markers' : 'Show incident markers'}
            aria-pressed={!incidentsVisible}
            title={incidentsVisible ? 'Hide incident markers on map' : 'Show incident markers on map'}
          >
            {incidentsVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            <span className="map-tool-text">
              {incidentsVisible ? 'Hide Incidents' : 'Show Incidents'}
            </span>
          </button>

          {/* Map-Local Filters Button */}
          <button
            type="button"
            className={`map-tool-btn ${isFilterPanelOpen ? 'tool-btn-active' : ''} ${hasFilterActive ? 'tool-btn-filtered' : ''}`}
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            aria-label="Map filters"
            aria-expanded={isFilterPanelOpen}
            title="Filter visible incidents by category and severity"
          >
            <Filter size={15} />
            <span className="map-tool-text">Filters</span>
            {hasFilterActive && (
              <span className="map-tool-badge">
                {activeCategoryCount}/{mapLegend.length}
              </span>
            )}
          </button>

          {/* Zoom controls (safely invoking mapInstance without useMap hook) */}
          <div className="map-zoom-btns">
            <button
              type="button"
              className="map-ctrl-btn"
              onClick={() => mapInstance?.zoomIn()}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="map-ctrl-btn"
              onClick={() => mapInstance?.zoomOut()}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <Minus size={15} />
            </button>
          </div>
        </div>

        {/* ── Notice Banner if markers are hidden ── */}
        {!incidentsVisible && (
          <div className="map-hidden-notice" role="status">
            <span>👁️ Incident markers are hidden ({incidents.length} active in data).</span>
            <button
              type="button"
              className="map-unhide-btn"
              onClick={handleToggleVisibility}
            >
              Show Markers
            </button>
          </div>
        )}

        {/* ── Map-Local Filter Drawer / Overlay Panel ── */}
        {isFilterPanelOpen && (
          <div className="map-filter-panel" ref={filterPanelRef} role="dialog" aria-label="Incident Filters">
            <div className="mf-header">
              <div className="mf-title">
                <Filter size={15} />
                <span>Incident Filters</span>
              </div>
              <div className="mf-actions">
                {hasFilterActive && (
                  <button
                    type="button"
                    className="mf-reset-btn"
                    onClick={handleResetFilters}
                    title="Reset all filters to default"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                )}
                <button
                  type="button"
                  className="mf-close-btn"
                  onClick={() => setIsFilterPanelOpen(false)}
                  aria-label="Close filters panel"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="mf-body">
              {/* Category Filter Section */}
              <div className="mf-section">
                <div className="mf-section-header">
                  <span className="mf-section-title">Incident Categories</span>
                  <span className="mf-section-sub">
                    {activeCategoryCount} of {mapLegend.length} active
                  </span>
                </div>
                <div className="mf-category-list">
                  {mapLegend.map((cat) => {
                    const isChecked = categories[cat.label] !== false;
                    const count = incidents.filter((i) => (i.category || 'Other') === cat.label).length;
                    return (
                      <button
                        type="button"
                        key={cat.label}
                        className={`mf-cat-btn ${isChecked ? 'active' : 'inactive'}`}
                        onClick={() => handleCategoryToggle(cat.label)}
                        aria-pressed={isChecked}
                      >
                        <span
                          className="mf-cat-dot"
                          style={{ background: isChecked ? cat.color : '#94a3b8' }}
                        />
                        <span className="mf-cat-label">{cat.label}</span>
                        <span className="mf-cat-count">({count})</span>
                        <span className="mf-cat-check">
                          {isChecked ? <Check size={12} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity Filter Section */}
              <div className="mf-section">
                <div className="mf-section-header">
                  <span className="mf-section-title">Severity Level</span>
                  <span className="mf-section-sub">Current: {severityFilter}</span>
                </div>
                <div className="mf-severity-chips">
                  {SEVERITY_OPTIONS.map((sev) => {
                    const isSelected = severityFilter.toLowerCase() === sev.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={sev}
                        className={`mf-sev-chip ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          if (onSelectSeverity) {
                            onSelectSeverity(sev);
                          } else {
                            setLocalSeverity(sev);
                          }
                        }}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visibility quick toggle inside panel */}
              <div className="mf-footer-toggle">
                <span>Map Marker Display:</span>
                <button
                  type="button"
                  className={`mf-vis-btn ${incidentsVisible ? 'shown' : 'hidden'}`}
                  onClick={handleToggleVisibility}
                >
                  {incidentsVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{incidentsVisible ? 'Visible on map' : 'Markers hidden'}</span>
                </button>
              </div>
            </div>
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

          {/* Dynamic map center controller (disabled while inspecting a route to prevent snapping back to GPS) */}
          <MapController center={centerCoord} zoom={13} disabled={Boolean(inspectedRoute)} />

          {/* Automatic fit bounds controller (frames bounds once per route selection) */}
          {routePolyline.length > 0 && (
            <RouteBoundsController routePoints={routePolyline} routeId={inspectedRoute?.id} />
          )}

          {/* Bridge to expose Leaflet map instance to outer toolbar */}
          <MapInstanceBridge onMapReady={setMapInstance} />

          {/* ── Inspected Route Polylines (Highlighted with color & glow) ── */}
          {routePolyline.length > 0 && (
            <>
              {/* Outer soft ambient indigo glow */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#4f46e5',
                  weight: 10,
                  opacity: 0.35,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Primary high-contrast navigation line in vibrant royal blue */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#2563eb',
                  weight: 5,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Inner directional navigation dash pulse */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#93c5fd',
                  weight: 2,
                  opacity: 0.85,
                  dashArray: '8, 12',
                  lineCap: 'round',
                }}
              />
            </>
          )}

          {/* Inspected Route Origin Marker (Point A) */}
          {inspectedRoute?.fromCoords && (
            <Marker
              position={[inspectedRoute.fromCoords.lat, inspectedRoute.fromCoords.lng]}
              icon={ROUTE_START_ICON}
            >
              <Popup>
                <div className="osm-popup">
                  <strong>🟢 Route Origin (Point A)</strong>
                  <p>{inspectedRoute.from}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Commute Route: <b>{inspectedRoute.name}</b>
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Inspected Route Destination Marker (Point B) */}
          {inspectedRoute?.toCoords && (
            <Marker
              position={[inspectedRoute.toCoords.lat, inspectedRoute.toCoords.lng]}
              icon={ROUTE_END_ICON}
            >
              <Popup>
                <div className="osm-popup">
                  <strong>🔴 Route Destination (Point B)</strong>
                  <p>{inspectedRoute.to}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Distance: <b>{inspectedRoute.distance || 'N/A'}</b> • Est: <b>{inspectedRoute.estTime || 'N/A'}</b>
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

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

          {/* Incident Pins (Rendered when incidentsVisible is true) */}
          {visibleIncidents.map((incident) => {
            const style = CATEGORY_STYLES[incident.category] ?? CATEGORY_STYLES.Other;
            const incLat = incident.coords?.lat ?? incident.lat;
            const incLng = incident.coords?.lng ?? incident.lng;
            const currentVote = popupVotes[incident.id] || (typeof localStorage !== 'undefined' ? localStorage.getItem(`its_vote_${incident.id}`) : null);

            const userCoord = deviceLocation || (selectedLocation.isCustom ? selectedLocation : null);
            const distMeters = userCoord && incLat != null && incLng != null 
              ? getDistanceMeters(userCoord.lat, userCoord.lng, incLat, incLng) 
              : null;
            const hasMedia = Boolean((incident.mediaUrls && incident.mediaUrls.length > 0) || incident.mediaCount > 0);
            const aiScore = incident.aiAuthenticityScore ?? (incident.mediaScore != null ? Math.round(incident.mediaScore * 100) : 0);
            const isAiPassed = Boolean(incident.aiVerified ?? (hasMedia && aiScore >= 70));
            const isWithin1km = distMeters != null && distMeters <= 1000;
            const canQuickVote = isAiPassed && isWithin1km;

            return (
              <Marker
                key={incident.id}
                position={[incLat, incLng]}
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

                    {/* Quick 1-tap verification row — gated by AI & 1000m proximity */}
                    {canQuickVote ? (
                      <div className="osm-popup-actions">
                        <button
                          type="button"
                          className={`osm-quick-btn btn-confirm ${currentVote === 'confirm' ? 'voted' : ''}`}
                          onClick={(e) => handleQuickVerify(e, incident.id, 'confirm', userCoord)}
                          title="Confirm incident is active (Within 1km)"
                        >
                          {currentVote === 'confirm' ? '✓ Confirmed' : '👍 Confirm'}
                        </button>
                        <button
                          type="button"
                          className={`osm-quick-btn btn-dispute ${currentVote === 'contradict' ? 'voted' : ''}`}
                          onClick={(e) => handleQuickVerify(e, incident.id, 'contradict', userCoord)}
                          title="Report as incorrect or not present (Within 1km)"
                        >
                          {currentVote === 'contradict' ? '✕ Disputed' : '👎 Dispute'}
                        </button>
                      </div>
                    ) : (
                      <div className="osm-popup-gatenote">
                        🔒 Voting locked: {!isAiPassed ? 'AI Screening Pending' : `Must be ≤1km (You: ${distMeters ? (distMeters/1000).toFixed(1) + 'km' : 'GPS needed'})`}
                      </div>
                    )}

                    <button
                      type="button"
                      className="osm-popup-link"
                      onClick={() => navigate(`/app/incidents/${incident.id}`)}
                    >
                      View Details & Timeline →
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

      {/* Edit Favorite Route Modal directly from Live Map */}
      {isEditModalOpen && inspectedRoute && (
        <AddFavoriteModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          itemToEdit={inspectedRoute}
          defaultTab="route"
        />
      )}
    </div>
  );
}
