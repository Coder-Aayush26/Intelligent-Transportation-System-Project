import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Plus, Minus, Eye, EyeOff, Filter, RotateCcw, X, Check
} from 'lucide-react';
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

/** Bridge component inside MapContainer to capture the Leaflet map instance safely */
function MapInstanceBridge({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (map) onMapReady(map);
  }, [map, onMapReady]);
  return null;
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
  const { 
    selectedLocation, 
    deviceLocation, 
    resetToDeviceLocation 
  } = useAppLocation();

  // Reference to Leaflet map instance captured from inside MapContainer
  const [mapInstance, setMapInstance] = useState(null);

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

        {/* ── Top-Left: Searched Location Badge ── */}
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

          {/* Dynamic map center controller */}
          <MapController center={centerCoord} zoom={13} />

          {/* Bridge to expose Leaflet map instance to outer toolbar */}
          <MapInstanceBridge onMapReady={setMapInstance} />

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
