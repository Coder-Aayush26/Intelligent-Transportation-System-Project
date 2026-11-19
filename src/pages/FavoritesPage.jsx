import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Navigation, MapPin, Plus, Star, Bell, BellOff, Trash2, Edit3,
  Car, Bike, Bus, AlertTriangle, CheckCircle2, 
  ExternalLink, Home, Briefcase, GraduationCap, Train,
  RefreshCw, Compass
} from 'lucide-react';
import { 
  getFavoriteRoutes, 
  deleteFavoriteRoute, 
  toggleRouteNotification, 
  getFavoritePlaces, 
  deleteFavoritePlace, 
  subscribeFavorites,
  checkRouteIncidents 
} from '../services/favoritesStorage';
import { fetchIncidents } from '../api/incidents';
import { useRealtime } from '../context/RealtimeContext';
import { useAppLocation } from '../context/LocationContext';
import AddFavoriteModal from '../components/common/AddFavoriteModal';
import ConfirmModal from '../components/common/ConfirmModal';
import './FavoritesPage.css';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { subscribe } = useRealtime();
  const { selectLocation } = useAppLocation();

  const [routes, setRoutes] = useState(getFavoriteRoutes);
  const [places, setPlaces] = useState(getFavoritePlaces);
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'places'

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalTab, setAddModalTab] = useState('route');
  const [itemToEdit, setItemToEdit] = useState(null);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [placeToDelete, setPlaceToDelete] = useState(null);

  // Sync favorites when changed in storage/sidebar
  const reloadFavorites = useCallback(() => {
    setRoutes(getFavoriteRoutes());
    setPlaces(getFavoritePlaces());
  }, []);

  useEffect(() => {
    const unsub = subscribeFavorites(reloadFavorites);
    return () => unsub();
  }, [reloadFavorites]);

  // Load active incidents to evaluate route safety live
  const loadActiveIncidents = useCallback(async () => {
    setLoadingIncidents(true);
    try {
      const data = await fetchIncidents();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load incidents for route safety:', err);
    } finally {
      setLoadingIncidents(false);
    }
  }, []);

  useEffect(() => {
    loadActiveIncidents();
    const unsub1 = subscribe('incident_created', loadActiveIncidents);
    const unsub2 = subscribe('incident_resolved', loadActiveIncidents);
    return () => {
      unsub1();
      unsub2();
    };
  }, [loadActiveIncidents, subscribe]);

  // Handle open add modal
  const handleOpenAddModal = (tab = 'route') => {
    setItemToEdit(null);
    setAddModalTab(tab);
    setIsAddModalOpen(true);
  };

  // Handle open edit modal for route
  const handleEditRoute = (route) => {
    setItemToEdit(route);
    setAddModalTab('route');
    setIsAddModalOpen(true);
  };

  // Handle open edit modal for place
  const handleEditPlace = (place) => {
    setItemToEdit(place);
    setAddModalTab('place');
    setIsAddModalOpen(true);
  };

  // Confirm delete route
  const handleConfirmDeleteRoute = () => {
    if (routeToDelete) {
      deleteFavoriteRoute(routeToDelete.id);
      setRouteToDelete(null);
    }
  };

  // Confirm delete place
  const handleConfirmDeletePlace = () => {
    if (placeToDelete) {
      deleteFavoritePlace(placeToDelete.id);
      setPlaceToDelete(null);
    }
  };

  // Center place on map and navigate
  const handleViewPlaceOnMap = (place) => {
    selectLocation({
      lat: place.lat,
      lng: place.lng,
      label: `${place.name} (${place.address})`,
    });
    navigate('/app/dashboard');
  };

  // Navigate to LiveMap with inspected route query
  const handleViewRouteOnMap = (route) => {
    navigate(`/app/dashboard?route=${encodeURIComponent(route.id)}`);
  };

  // Calculate live safety report for all routes
  const routeStatusMap = useMemo(() => {
    const map = {};
    routes.forEach((route) => {
      const near = checkRouteIncidents(route, incidents, 2500);
      map[route.id] = {
        hasIncidents: near.length > 0,
        incidentCount: near.length,
        incidents: near,
      };
    });
    return map;
  }, [routes, incidents]);

  const totalHazardsOnRoutes = useMemo(() => {
    return Object.values(routeStatusMap).filter((s) => s.hasIncidents).length;
  }, [routeStatusMap]);

  return (
    <div className="favorites-page-container">
      {/* ── Page Header ── */}
      <div className="fav-page-header">
        <div className="fav-header-info">
          <div className="fav-title-row">
            <div className="fav-page-badge">
              <Star size={18} />
            </div>
            <h2>Monitored Favorites & Commute Routes</h2>
          </div>
          <p>
            Track real-time traffic conditions, automated hazard alerts, and active blockages along your saved commutes and frequent locations.
          </p>
        </div>

        <div className="fav-header-actions">
          <button
            type="button"
            className="fav-header-add-btn"
            onClick={() => handleOpenAddModal('route')}
          >
            <Plus size={16} />
            <span>Add Route / Place</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Row ── */}
      <div className="fav-kpi-grid">
        <div className="fav-kpi-card">
          <div className="fav-kpi-icon blue">
            <Navigation size={20} />
          </div>
          <div className="fav-kpi-details">
            <span className="fav-kpi-label">Saved Commute Routes</span>
            <span className="fav-kpi-val">{routes.length}</span>
            <span className="fav-kpi-sub">Continuous hazard surveillance</span>
          </div>
        </div>

        <div className={`fav-kpi-card ${totalHazardsOnRoutes > 0 ? 'warning' : 'success'}`}>
          <div className={`fav-kpi-icon ${totalHazardsOnRoutes > 0 ? 'orange' : 'green'}`}>
            {totalHazardsOnRoutes > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="fav-kpi-details">
            <span className="fav-kpi-label">Route Safety Status</span>
            <span className="fav-kpi-val">
              {totalHazardsOnRoutes > 0 ? `${totalHazardsOnRoutes} Route(s) Impacted` : 'All Routes Clear'}
            </span>
            <span className="fav-kpi-sub">
              {totalHazardsOnRoutes > 0 ? 'Active delays or incidents reported' : 'No active blockages on saved paths'}
            </span>
          </div>
        </div>

        <div className="fav-kpi-card">
          <div className="fav-kpi-icon purple">
            <MapPin size={20} />
          </div>
          <div className="fav-kpi-details">
            <span className="fav-kpi-label">Frequent Places</span>
            <span className="fav-kpi-val">{places.length}</span>
            <span className="fav-kpi-sub">Home, Work, transit hubs</span>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div className="fav-main-nav">
        <button
          type="button"
          className={`fav-nav-tab ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <Navigation size={16} />
          <span>Commute Routes ({routes.length})</span>
        </button>
        <button
          type="button"
          className={`fav-nav-tab ${activeTab === 'places' ? 'active' : ''}`}
          onClick={() => setActiveTab('places')}
        >
          <MapPin size={16} />
          <span>Frequent Places ({places.length})</span>
        </button>

        <div className="fav-tab-actions">
          <button
            type="button"
            className="fav-refresh-btn"
            onClick={loadActiveIncidents}
            disabled={loadingIncidents}
            title="Refresh route incident conditions"
          >
            <RefreshCw size={13} className={loadingIncidents ? 'spinning' : ''} />
            <span>Check Road Conditions</span>
          </button>
        </div>
      </div>

      {/* ── Tab Content: Commute Routes ── */}
      {activeTab === 'routes' && (
        <div className="fav-content-section">
          {routes.length === 0 ? (
            <div className="fav-empty-state">
              <Compass size={40} className="fav-empty-icon" />
              <h3>No Favorite Routes Added Yet</h3>
              <p>Add your daily commute or frequent travel corridor to receive real-time hazard warnings and 1-tap live map navigation.</p>
              <button
                type="button"
                className="fav-empty-action"
                onClick={() => handleOpenAddModal('route')}
              >
                <Plus size={16} />
                <span>Add Your First Route</span>
              </button>
            </div>
          ) : (
            <div className="fav-route-cards-grid">
              {routes.map((route) => {
                const status = routeStatusMap[route.id] || { hasIncidents: false, incidentCount: 0 };
                const ModeIcon = route.mode === 'two-wheeler' ? Bike : route.mode === 'transit' ? Bus : Car;

                return (
                  <div key={route.id} className={`fav-route-card ${status.hasIncidents ? 'has-hazard' : ''}`}>
                    {/* Top row */}
                    <div className="fav-card-top">
                      <div className="fav-card-title-group">
                        <div className="fav-mode-icon-tag" title={`Mode: ${route.mode}`}>
                          <ModeIcon size={16} />
                        </div>
                        <div>
                          <h4 className="fav-route-title">{route.name}</h4>
                          <span className="fav-route-specs">
                            {route.distance || '7.5 km'} • Est. {route.estTime || '15 mins'}
                          </span>
                        </div>
                      </div>

                      <div className="fav-card-quick-actions">
                        <button
                          type="button"
                          className="fav-edit-btn"
                          onClick={() => handleEditRoute(route)}
                          title="Edit route details"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className={`fav-notify-toggle ${route.notify ? 'active' : ''}`}
                          onClick={() => toggleRouteNotification(route.id)}
                          title={route.notify ? 'Hazard push alerts enabled (Click to mute)' : 'Hazard push alerts muted (Click to enable)'}
                        >
                          {route.notify ? <Bell size={15} /> : <BellOff size={15} />}
                        </button>
                        <button
                          type="button"
                          className="fav-delete-btn"
                          onClick={() => setRouteToDelete(route)}
                          title="Remove route from favorites"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Endpoints */}
                    <div className="fav-route-endpoints">
                      <div className="fav-endpoint-item">
                        <span className="ep-dot start" />
                        <span className="ep-label">FROM</span>
                        <span className="ep-val">{route.from}</span>
                      </div>
                      <div className="fav-endpoint-connector" />
                      <div className="fav-endpoint-item">
                        <span className="ep-dot end" />
                        <span className="ep-label">TO</span>
                        <span className="ep-val">{route.to}</span>
                      </div>
                    </div>

                    {/* Live Safety Status Pill */}
                    <div className={`fav-route-status-pill ${status.hasIncidents ? 'hazard' : 'clear'}`}>
                      {status.hasIncidents ? (
                        <>
                          <AlertTriangle size={14} />
                          <span>
                            <b>{status.incidentCount} active hazard(s)</b> near this route path
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Road conditions clear • Normal traffic flow</span>
                        </>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="fav-card-foot">
                      <button
                        type="button"
                        className="fav-edit-action-btn"
                        onClick={() => handleEditRoute(route)}
                      >
                        <Edit3 size={14} />
                        <span>Edit Route</span>
                      </button>
                      <button
                        type="button"
                        className="fav-view-map-btn"
                        onClick={() => handleViewRouteOnMap(route)}
                      >
                        <ExternalLink size={14} />
                        <span>Inspect on Live Map</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Frequent Places ── */}
      {activeTab === 'places' && (
        <div className="fav-content-section">
          {places.length === 0 ? (
            <div className="fav-empty-state">
              <MapPin size={40} className="fav-empty-icon" />
              <h3>No Frequent Places Saved</h3>
              <p>Save key places like Home, Office, or University for 1-click map centering and rapid incident checks.</p>
              <button
                type="button"
                className="fav-empty-action"
                onClick={() => handleOpenAddModal('place')}
              >
                <Plus size={16} />
                <span>Add Favorite Place</span>
              </button>
            </div>
          ) : (
            <div className="fav-places-cards-grid">
              {places.map((place) => {
                const PlaceIcon = 
                  place.type === 'home' ? Home :
                  place.type === 'work' ? Briefcase :
                  place.type === 'school' ? GraduationCap :
                  place.type === 'station' ? Train : MapPin;

                return (
                  <div key={place.id} className="fav-place-card">
                    <div className="fav-place-card-top">
                      <div className="fav-place-icon-badge">
                        <PlaceIcon size={18} />
                      </div>
                      <div className="fav-place-header-text">
                        <h4>{place.name}</h4>
                        <span className="fav-place-category">{place.type?.toUpperCase() || 'PLACE'}</span>
                      </div>
                      <div className="fav-card-quick-actions">
                        <button
                          type="button"
                          className="fav-edit-btn"
                          onClick={() => handleEditPlace(place)}
                          title="Edit place details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="fav-delete-btn"
                          onClick={() => setPlaceToDelete(place)}
                          title="Remove place"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <p className="fav-place-address">{place.address}</p>

                    <div className="fav-place-foot">
                      <button
                        type="button"
                        className="fav-edit-action-btn"
                        onClick={() => handleEditPlace(place)}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="fav-view-map-btn"
                        onClick={() => handleViewPlaceOnMap(place)}
                      >
                        <ExternalLink size={14} />
                        <span>Center on Live Map</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Favorite Modal ── */}
      <AddFavoriteModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setItemToEdit(null);
        }}
        defaultTab={addModalTab}
        itemToEdit={itemToEdit}
      />

      {/* ── Confirm Delete Route Modal ── */}
      <ConfirmModal
        isOpen={Boolean(routeToDelete)}
        title="Delete Favorite Route"
        message={`Are you sure you want to remove "${routeToDelete?.name}" from your monitored routes?`}
        confirmText="Delete Route"
        isDanger={true}
        onConfirm={handleConfirmDeleteRoute}
        onCancel={() => setRouteToDelete(null)}
      />

      {/* ── Confirm Delete Place Modal ── */}
      <ConfirmModal
        isOpen={Boolean(placeToDelete)}
        title="Delete Saved Place"
        message={`Are you sure you want to remove "${placeToDelete?.name}" from your saved locations?`}
        confirmText="Delete Place"
        isDanger={true}
        onConfirm={handleConfirmDeletePlace}
        onCancel={() => setPlaceToDelete(null)}
      />
    </div>
  );
}
