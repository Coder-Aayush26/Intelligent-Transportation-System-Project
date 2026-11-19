import { useState, useEffect, useRef } from 'react';
import { 
  X, Navigation, MapPin, Plus, Car, Bike, Bus, 
  Home, Briefcase, GraduationCap, Train, ShieldCheck, Check, Loader2
} from 'lucide-react';
import { useAppLocation } from '../../context/LocationContext';
import { 
  saveFavoriteRoute, 
  saveFavoritePlace, 
  getFavoritePlaces,
  lookupLandmarkCoords,
  searchLandmarks,
  parseCoordinateString,
  computeDistanceMeters
} from '../../services/favoritesStorage';
import { geocodeSearch } from '../../api/location';
import './AddFavoriteModal.css';

export default function AddFavoriteModal({ 
  isOpen, 
  onClose, 
  defaultTab = 'route',
  itemToEdit = null 
}) {
  const { deviceLocation, selectedLocation, requestDeviceLocation } = useAppLocation();
  const [activeTab, setActiveTab] = useState(defaultTab); // 'route' | 'place'

  // Route Form State
  const [routeName, setRouteName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [mode, setMode] = useState('driving');
  const [estDistance, setEstDistance] = useState('');
  const [estTime, setEstTime] = useState('');
  const [notify, setNotify] = useState(true);

  // Suggestions state
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [placeSuggestions, setPlaceSuggestions] = useState([]);
  const [isOriginFocused, setIsOriginFocused] = useState(false);
  const [isDestFocused, setIsDestFocused] = useState(false);
  const [isPlaceFocused, setIsPlaceFocused] = useState(false);

  // GPS Locating loaders
  const [isLocatingOrigin, setIsLocatingOrigin] = useState(false);
  const [isLocatingDest, setIsLocatingDest] = useState(false);
  const [isLocatingPlace, setIsLocatingPlace] = useState(false);

  // Place Form State
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeCoords, setPlaceCoords] = useState(null);
  const [placeType, setPlaceType] = useState('home');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(itemToEdit);

  const originWrapRef = useRef(null);
  const destWrapRef = useRef(null);
  const placeWrapRef = useRef(null);
  const originTimerRef = useRef(null);
  const destTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (itemToEdit) {
      if (itemToEdit.from !== undefined) {
        // It's a route
        setActiveTab('route');
        setRouteName(itemToEdit.name || '');
        setOrigin(itemToEdit.from || '');
        setDestination(itemToEdit.to || '');
        setOriginCoords(itemToEdit.fromCoords || null);
        setDestinationCoords(itemToEdit.toCoords || null);
        setMode(itemToEdit.mode || 'driving');
        setEstDistance(itemToEdit.distance || '');
        setEstTime(itemToEdit.estTime || '');
        setNotify(itemToEdit.notify ?? true);
      } else {
        // It's a place
        setActiveTab('place');
        setPlaceName(itemToEdit.name || '');
        setPlaceAddress(itemToEdit.address || '');
        setPlaceCoords(itemToEdit.lat ? { lat: itemToEdit.lat, lng: itemToEdit.lng } : null);
        setPlaceType(itemToEdit.type || 'home');
      }
    } else {
      setActiveTab(defaultTab);
      setRouteName('');
      setOrigin('');
      setDestination('');
      setOriginCoords(null);
      setDestinationCoords(null);
      setMode('driving');
      setEstDistance('');
      setEstTime('');
      setNotify(true);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceCoords(null);
      setPlaceType('home');
    }
    setFormError('');
    setOriginSuggestions([]);
    setDestSuggestions([]);
    setPlaceSuggestions([]);
  }, [isOpen, itemToEdit, defaultTab]);

  // Click outside to close suggestion dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (originWrapRef.current && !originWrapRef.current.contains(e.target)) {
        setIsOriginFocused(false);
      }
      if (destWrapRef.current && !destWrapRef.current.contains(e.target)) {
        setIsDestFocused(false);
      }
      if (placeWrapRef.current && !placeWrapRef.current.contains(e.target)) {
        setIsPlaceFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!isOpen) return null;

  // ── Acquire True GPS Position for Starting Point ──
  const handleUseCurrentLocationForOrigin = async () => {
    setIsLocatingOrigin(true);
    setFormError('');
    try {
      const loc = await requestDeviceLocation(true);
      if (loc && loc.lat && loc.lng) {
        const coords = { lat: Number(loc.lat), lng: Number(loc.lng) };
        setOriginCoords(coords);
        const label = loc.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        setOrigin(label);
        setIsOriginFocused(false);
      } else {
        throw new Error('No GPS coordinates acquired');
      }
    } catch {
      if (deviceLocation && deviceLocation.lat && deviceLocation.lng) {
        const coords = { lat: Number(deviceLocation.lat), lng: Number(deviceLocation.lng) };
        setOriginCoords(coords);
        setOrigin(deviceLocation.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setIsOriginFocused(false);
      } else {
        setFormError('Could not acquire GPS position. Please check your browser location permission or choose from the quick shortcuts below.');
      }
    } finally {
      setIsLocatingOrigin(false);
    }
  };

  // ── Acquire True GPS Position for Destination ──
  const handleUseCurrentLocationForDest = async () => {
    setIsLocatingDest(true);
    setFormError('');
    try {
      const loc = await requestDeviceLocation(true);
      if (loc && loc.lat && loc.lng) {
        const coords = { lat: Number(loc.lat), lng: Number(loc.lng) };
        setDestinationCoords(coords);
        const label = loc.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        setDestination(label);
        setIsDestFocused(false);
      } else {
        throw new Error('No GPS coordinates acquired');
      }
    } catch {
      if (deviceLocation && deviceLocation.lat && deviceLocation.lng) {
        const coords = { lat: Number(deviceLocation.lat), lng: Number(deviceLocation.lng) };
        setDestinationCoords(coords);
        setDestination(deviceLocation.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setIsDestFocused(false);
      } else {
        setFormError('Could not acquire GPS position for destination. Please choose from the shortcuts or type an address.');
      }
    } finally {
      setIsLocatingDest(false);
    }
  };

  // ── Acquire True GPS Position for Place Address ──
  const handleUseCurrentLocationForPlace = async () => {
    setIsLocatingPlace(true);
    setFormError('');
    try {
      const loc = await requestDeviceLocation(true);
      if (loc && loc.lat && loc.lng) {
        const coords = { lat: Number(loc.lat), lng: Number(loc.lng) };
        setPlaceCoords(coords);
        setPlaceAddress(loc.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setIsPlaceFocused(false);
      } else {
        throw new Error('No GPS coordinates acquired');
      }
    } catch {
      if (deviceLocation && deviceLocation.lat && deviceLocation.lng) {
        const coords = { lat: Number(deviceLocation.lat), lng: Number(deviceLocation.lng) };
        setPlaceCoords(coords);
        setPlaceAddress(deviceLocation.locality || `Current Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setIsPlaceFocused(false);
      } else {
        setFormError('Could not acquire GPS position. Please enter address manually.');
      }
    } finally {
      setIsLocatingPlace(false);
    }
  };

  // ── Autocomplete Search for Origin ──
  const handleOriginChange = (val) => {
    setOrigin(val);
    setOriginCoords(null); // Reset locked coords on manual typing
    clearTimeout(originTimerRef.current);
    if (val.trim().length > 0) {
      const matches = searchLandmarks(val);
      setOriginSuggestions(matches);
      setIsOriginFocused(true);

      if (val.trim().length >= 2) {
        originTimerRef.current = setTimeout(() => {
          geocodeSearch(val, {
            lat: deviceLocation?.lat,
            lng: deviceLocation?.lng,
          }).then((res) => {
            if (res && res.length > 0) {
              const external = res.map((r) => ({
                name: r.displayName.split(',')[0],
                subtitle: r.displayName,
                category: 'search',
                coords: { lat: r.lat, lng: r.lng },
              }));
              setOriginSuggestions((prev) => {
                const combined = [...external, ...prev];
                const seen = new Set();
                return combined.filter((item) => {
                  const k = `${item.coords.lat.toFixed(4)},${item.coords.lng.toFixed(4)}`;
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                }).slice(0, 8);
              });
            }
          }).catch(() => {});
        }, 250);
      }
    } else {
      setOriginSuggestions([]);
      setIsOriginFocused(false);
    }
  };

  // ── Autocomplete Search for Destination ──
  const handleDestChange = (val) => {
    setDestination(val);
    setDestinationCoords(null); // Reset locked coords on manual typing
    clearTimeout(destTimerRef.current);
    if (val.trim().length > 0) {
      const matches = searchLandmarks(val);
      setDestSuggestions(matches);
      setIsDestFocused(true);

      if (val.trim().length >= 2) {
        destTimerRef.current = setTimeout(() => {
          geocodeSearch(val, {
            lat: deviceLocation?.lat,
            lng: deviceLocation?.lng,
          }).then((res) => {
            if (res && res.length > 0) {
              const external = res.map((r) => ({
                name: r.displayName.split(',')[0],
                subtitle: r.displayName,
                category: 'search',
                coords: { lat: r.lat, lng: r.lng },
              }));
              setDestSuggestions((prev) => {
                const combined = [...external, ...prev];
                const seen = new Set();
                return combined.filter((item) => {
                  const k = `${item.coords.lat.toFixed(4)},${item.coords.lng.toFixed(4)}`;
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                }).slice(0, 8);
              });
            }
          }).catch(() => {});
        }, 250);
      }
    } else {
      setDestSuggestions([]);
      setIsDestFocused(false);
    }
  };

  // ── Autocomplete Search for Place Address ──
  const handlePlaceAddressChange = (val) => {
    setPlaceAddress(val);
    setPlaceCoords(null);
    if (val.trim().length > 0) {
      const matches = searchLandmarks(val);
      setPlaceSuggestions(matches);
      setIsPlaceFocused(true);
    } else {
      setPlaceSuggestions([]);
      setIsPlaceFocused(false);
    }
  };

  const handleSelectOrigin = (item) => {
    setOrigin(item.name);
    setOriginCoords(item.coords);
    setIsOriginFocused(false);
  };

  const handleSelectDest = (item) => {
    setDestination(item.name);
    setDestinationCoords(item.coords);
    setIsDestFocused(false);
  };

  const handleSelectPlace = (item) => {
    setPlaceAddress(item.name);
    setPlaceCoords(item.coords);
    setIsPlaceFocused(false);
  };

  /**
   * Helper to resolve accurate coordinates from user text input or explicit GPS.
   * Prioritizes online geocoding with user GPS proximity bias so queries anywhere
   * (e.g. "Delhi Airport", "Terminal 3", "Kempegowda Airport", "Taj Mahal", "Vadodara Station")
   * accurately resolve to their real coordinates without being hijacked by local defaults.
   */
  const resolveCoordinates = async (text, explicitCoord = null) => {
    if (explicitCoord && !isNaN(explicitCoord.lat) && !isNaN(explicitCoord.lng)) {
      return explicitCoord;
    }
    if (!text || !text.trim()) return null;

    // 1. Direct coordinate check (e.g. "22.7533, 75.8937")
    const coord = parseCoordinateString(text);
    if (coord) return coord;

    // 2. Check saved user favorite places (Home, Work, etc.)
    const places = getFavoritePlaces();
    const cleanLower = text.toLowerCase().trim();
    const matchedPlace = places.find((p) => {
      const pName = p.name.toLowerCase();
      const pAddr = (p.address || '').toLowerCase();
      return pName === cleanLower || pAddr === cleanLower;
    });
    if (matchedPlace) {
      return { lat: Number(matchedPlace.lat), lng: Number(matchedPlace.lng) };
    }

    // 3. Online Geocoding FIRST with user's real device GPS proximity bias
    // This allows any landmark/city/airport/station worldwide to resolve to its real accurate coordinates!
    try {
      const results = await geocodeSearch(text, {
        lat: deviceLocation?.lat,
        lng: deviceLocation?.lng,
      });
      if (results && results.length > 0) {
        const first = results.find((r) => !isNaN(r.lat) && !isNaN(r.lng));
        if (first) {
          return { lat: first.lat, lng: first.lng };
        }
      }
    } catch {
      // ignore network errors and proceed to local directory fallback
    }

    // 4. Fallback to local surveyed landmarks ONLY if online geocoding didn't resolve and query matches an exact surveyed landmark
    const landmark = lookupLandmarkCoords(text);
    if (landmark) return landmark;

    return null;
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    if (!routeName.trim()) {
      setFormError('Please enter a descriptive name for your route.');
      return;
    }
    if (!origin.trim()) {
      setFormError('Please specify the starting point (origin).');
      return;
    }
    if (!destination.trim()) {
      setFormError('Please specify the destination.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const fromCoords = await resolveCoordinates(origin, originCoords);
      if (!fromCoords) {
        setFormError(`Could not locate starting point "${origin}". Please select an item from suggestions or click Use Current Location.`);
        setIsSaving(false);
        return;
      }

      const toCoords = await resolveCoordinates(destination, destinationCoords);
      if (!toCoords) {
        setFormError(`Could not locate destination "${destination}". Please select from suggestions or enter an address.`);
        setIsSaving(false);
        return;
      }

      // Compute actual distance between endpoints
      const dMeters = computeDistanceMeters(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
      const km = (dMeters / 1000).toFixed(1);

      // Auto-compute distance and travel time if not manually typed
      let finalDistance = estDistance.trim();
      let finalTime = estTime.trim();

      if (!finalDistance) {
        finalDistance = `${km} km`;
      }
      if (!finalTime) {
        const factor = mode === 'two-wheeler' ? 2.2 : mode === 'transit' ? 3.0 : 2.5;
        const mins = Math.max(5, Math.round((dMeters / 1000) * factor));
        finalTime = `${mins} mins`;
      }

      saveFavoriteRoute({
        ...(itemToEdit || {}),
        id: itemToEdit?.id,
        name: routeName.trim(),
        from: origin.trim(),
        to: destination.trim(),
        fromCoords,
        toCoords,
        distance: finalDistance,
        estTime: finalTime,
        mode,
        notify,
        status: itemToEdit?.status || 'clear',
      });

      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save route. Please check coordinates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePlace = async (e) => {
    e.preventDefault();
    if (!placeName.trim()) {
      setFormError('Please enter a label for this place.');
      return;
    }
    if (!placeAddress.trim()) {
      setFormError('Please enter the address or landmark.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const coords = await resolveCoordinates(placeAddress, placeCoords);
      if (!coords) {
        setFormError(`Could not locate address "${placeAddress}". Please select from suggestions or specify an area.`);
        setIsSaving(false);
        return;
      }

      saveFavoritePlace({
        ...(itemToEdit || {}),
        id: itemToEdit?.id,
        name: placeName.trim(),
        address: placeAddress.trim(),
        lat: coords.lat,
        lng: coords.lng,
        type: placeType,
      });

      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save place.');
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamic quick pills: real device GPS + user's saved favorite places (never hardcoded city defaults)
  const savedPlaces = getFavoritePlaces();
  const savedHome = savedPlaces.find((p) => p.type === 'home');
  const savedWork = savedPlaces.find((p) => p.type === 'work');
  const otherSaved = savedPlaces.filter((p) => p.type !== 'home' && p.type !== 'work');

  const QUICK_DESTINATIONS = [
    ...(deviceLocation ? [{
      label: '📍 Current GPS',
      coords: { lat: deviceLocation.lat, lng: deviceLocation.lng },
      name: deviceLocation.locality || 'Current Location',
    }] : []),
    ...(savedHome ? [{
      label: '🏠 Home',
      coords: { lat: Number(savedHome.lat), lng: Number(savedHome.lng) },
      name: savedHome.address || savedHome.name,
    }] : []),
    ...(savedWork ? [{
      label: '💼 Work / Office',
      coords: { lat: Number(savedWork.lat), lng: Number(savedWork.lng) },
      name: savedWork.address || savedWork.name,
    }] : []),
    ...otherSaved.slice(0, 3).map((p) => ({
      label: `📍 ${p.name}`,
      coords: { lat: Number(p.lat), lng: Number(p.lng) },
      name: p.address || p.name,
    })),
  ];

  const QUICK_ORIGINS = [
    ...(deviceLocation ? [{
      label: '📍 Current GPS',
      coords: { lat: deviceLocation.lat, lng: deviceLocation.lng },
      name: deviceLocation.locality || 'Current Location',
    }] : []),
    ...(savedHome ? [{
      label: '🏠 Home',
      coords: { lat: Number(savedHome.lat), lng: Number(savedHome.lng) },
      name: savedHome.address || savedHome.name,
    }] : []),
    ...(savedWork ? [{
      label: '💼 Work / Office',
      coords: { lat: Number(savedWork.lat), lng: Number(savedWork.lng) },
      name: savedWork.address || savedWork.name,
    }] : []),
    ...otherSaved.slice(0, 3).map((p) => ({
      label: `📍 ${p.name}`,
      coords: { lat: Number(p.lat), lng: Number(p.lng) },
      name: p.address || p.name,
    })),
  ];

  return (
    <div className="fav-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fav-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fav-modal-header">
          <div className="fav-modal-title-wrap">
            <div className="fav-icon-pill">
              <Navigation size={18} />
            </div>
            <div>
              <h3>{isEditing ? (activeTab === 'route' ? 'Edit Favorite Route' : 'Edit Saved Place') : 'Add to Favorites'}</h3>
              <p>
                {isEditing 
                  ? 'Update commute endpoints, coordinates, travel mode, or real-time alert preferences.' 
                  : 'Save daily commute routes or frequent locations for rapid incident monitoring.'}
              </p>
            </div>
          </div>
          <button type="button" className="fav-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        {!isEditing && (
          <div className="fav-tab-row">
            <button
              type="button"
              className={`fav-tab-btn ${activeTab === 'route' ? 'active' : ''}`}
              onClick={() => { setActiveTab('route'); setFormError(''); }}
            >
              <Navigation size={15} />
              <span>Favorite Route</span>
            </button>
            <button
              type="button"
              className={`fav-tab-btn ${activeTab === 'place' ? 'active' : ''}`}
              onClick={() => { setActiveTab('place'); setFormError(''); }}
            >
              <MapPin size={15} />
              <span>Frequent Place</span>
            </button>
          </div>
        )}

        {formError && (
          <div className="fav-modal-error">
            <span>⚠️ {formError}</span>
          </div>
        )}

        {/* Form: Route */}
        {activeTab === 'route' && (
          <form onSubmit={handleSaveRoute} className="fav-modal-form">
            <div className="fav-form-group">
              <label htmlFor="fav-route-name">Route Name / Commute Title *</label>
              <input
                id="fav-route-name"
                type="text"
                placeholder="e.g., Morning Office Commute, Campus Route"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                required
              />
            </div>

            {/* Starting Point (Origin) */}
            <div className="fav-form-group" ref={originWrapRef}>
              <div className="fav-label-with-action">
                <label htmlFor="fav-route-origin">
                  Starting Point (Origin) *
                  {originCoords && (
                    <span className="fav-coord-locked-tag">
                      ✓ GPS Locked ({originCoords.lat.toFixed(4)}, {originCoords.lng.toFixed(4)})
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForOrigin}
                  className="fav-text-btn"
                  disabled={isLocatingOrigin}
                  title="Detect and use your browser GPS location"
                >
                  {isLocatingOrigin ? (
                    <>
                      <Loader2 size={11} className="spinning" />
                      <span>Acquiring GPS…</span>
                    </>
                  ) : (
                    <span>📍 Use Current Location</span>
                  )}
                </button>
              </div>

              <div className="fav-input-wrap">
                <input
                  id="fav-route-origin"
                  type="text"
                  placeholder="Type starting point, landmark, or click Use Current Location"
                  value={origin}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  onFocus={() => {
                    if (origin.trim().length > 0) setIsOriginFocused(true);
                  }}
                  required
                />

                {/* Suggestions Dropdown for Origin */}
                {isOriginFocused && originSuggestions.length > 0 && (
                  <div className="fav-suggestions-dropdown">
                    {originSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="fav-sug-item"
                        onClick={() => handleSelectOrigin(item)}
                      >
                        <div className="fav-sug-icon">
                          {item.category === 'gps' ? '📍' : item.category === 'transit' ? '🚆' : item.category === 'work' ? '💼' : '🏛️'}
                        </div>
                        <div className="fav-sug-body">
                          <span className="fav-sug-title">{item.name}</span>
                          <span className="fav-sug-sub">{item.subtitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Origin Shortcuts */}
              <div className="fav-quick-pills">
                <span className="fav-quick-label">Quick select:</span>
                {QUICK_ORIGINS.map((pill, i) => (
                  <button
                    key={i}
                    type="button"
                    className="fav-quick-pill"
                    onClick={() => {
                      setOrigin(pill.name);
                      setOriginCoords(pill.coords);
                      setIsOriginFocused(false);
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div className="fav-form-group" ref={destWrapRef}>
              <div className="fav-label-with-action">
                <label htmlFor="fav-route-dest">
                  Destination (Endpoint) *
                  {destinationCoords && (
                    <span className="fav-coord-locked-tag">
                      ✓ Destination Locked ({destinationCoords.lat.toFixed(4)}, {destinationCoords.lng.toFixed(4)})
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForDest}
                  className="fav-text-btn"
                  disabled={isLocatingDest}
                  title="Set destination to your current GPS position"
                >
                  {isLocatingDest ? (
                    <>
                      <Loader2 size={11} className="spinning" />
                      <span>Acquiring GPS…</span>
                    </>
                  ) : (
                    <span>📍 Use Current Location</span>
                  )}
                </button>
              </div>

              <div className="fav-input-wrap">
                <input
                  id="fav-route-dest"
                  type="text"
                  placeholder="Type destination, landmark, or address (or select shortcut)"
                  value={destination}
                  onChange={(e) => handleDestChange(e.target.value)}
                  onFocus={() => {
                    if (destination.trim().length > 0) setIsDestFocused(true);
                  }}
                  required
                />

                {/* Suggestions Dropdown for Destination */}
                {isDestFocused && destSuggestions.length > 0 && (
                  <div className="fav-suggestions-dropdown">
                    {destSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="fav-sug-item"
                        onClick={() => handleSelectDest(item)}
                      >
                        <div className="fav-sug-icon">
                          {item.category === 'gps' ? '📍' : item.category === 'transit' ? '✈️' : item.category === 'work' ? '💼' : '🏛️'}
                        </div>
                        <div className="fav-sug-body">
                          <span className="fav-sug-title">{item.name}</span>
                          <span className="fav-sug-sub">{item.subtitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Destination Shortcuts */}
              <div className="fav-quick-pills">
                <span className="fav-quick-label">Quick select:</span>
                {QUICK_DESTINATIONS.map((pill, i) => (
                  <button
                    key={i}
                    type="button"
                    className="fav-quick-pill"
                    onClick={() => {
                      setDestination(pill.name);
                      setDestinationCoords(pill.coords);
                      setIsDestFocused(false);
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Mode */}
            <div className="fav-form-group">
              <label>Commute Mode</label>
              <div className="fav-mode-selector">
                {[
                  { id: 'driving', label: 'Car / Auto', icon: Car },
                  { id: 'two-wheeler', label: 'Bike / Scooter', icon: Bike },
                  { id: 'transit', label: 'City Bus / Metro', icon: Bus },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`fav-mode-pill ${mode === item.id ? 'active' : ''}`}
                      onClick={() => setMode(item.id)}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fav-form-row">
              <div className="fav-form-group flex-1">
                <label htmlFor="fav-distance">Distance (auto-computed from road path)</label>
                <input
                  id="fav-distance"
                  type="text"
                  placeholder="e.g. 7.5 km"
                  value={estDistance}
                  onChange={(e) => setEstDistance(e.target.value)}
                />
              </div>
              <div className="fav-form-group flex-1">
                <label htmlFor="fav-est-time">Expected Time (auto-computed)</label>
                <input
                  id="fav-est-time"
                  type="text"
                  placeholder="e.g. 18 mins"
                  value={estTime}
                  onChange={(e) => setEstTime(e.target.value)}
                />
              </div>
            </div>

            {/* Notification Checkbox */}
            <div className="fav-checkbox-card">
              <input
                type="checkbox"
                id="fav-notify"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              <label htmlFor="fav-notify">
                <span className="fav-cb-title">🚨 Real-time Hazard Push Alerts</span>
                <span className="fav-cb-desc">Notify me whenever road blockages, accidents, or waterlogging are verified along this route.</span>
              </label>
            </div>

            {/* Actions */}
            <div className="fav-modal-actions">
              <button type="button" className="fav-btn-cancel" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="fav-btn-submit" disabled={isSaving}>
                {isSaving ? <Loader2 size={16} className="spinning" /> : isEditing ? <Check size={16} /> : <Plus size={16} />}
                <span>{isSaving ? 'Locking Coordinates & Saving…' : isEditing ? 'Save Changes' : 'Save Favorite Route'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Form: Place */}
        {activeTab === 'place' && (
          <form onSubmit={handleSavePlace} className="fav-modal-form">
            <div className="fav-form-group">
              <label htmlFor="fav-place-name">Place Name *</label>
              <input
                id="fav-place-name"
                type="text"
                placeholder="e.g. Home, Office, Gym, University"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                required
              />
            </div>

            <div className="fav-form-group" ref={placeWrapRef}>
              <div className="fav-label-with-action">
                <label htmlFor="fav-place-addr">
                  Address or Landmark *
                  {placeCoords && (
                    <span className="fav-coord-locked-tag">
                      ✓ GPS Locked ({placeCoords.lat.toFixed(4)}, {placeCoords.lng.toFixed(4)})
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForPlace}
                  className="fav-text-btn"
                  disabled={isLocatingPlace}
                >
                  {isLocatingPlace ? (
                    <>
                      <Loader2 size={11} className="spinning" />
                      <span>Acquiring GPS…</span>
                    </>
                  ) : (
                    <span>📍 Use Current Location</span>
                  )}
                </button>
              </div>

              <div className="fav-input-wrap">
                <input
                  id="fav-place-addr"
                  type="text"
                  placeholder="e.g. Scheme No 54, Vijay Nagar, Indore"
                  value={placeAddress}
                  onChange={(e) => handlePlaceAddressChange(e.target.value)}
                  onFocus={() => {
                    if (placeAddress.trim().length > 0) setIsPlaceFocused(true);
                  }}
                  required
                />

                {isPlaceFocused && placeSuggestions.length > 0 && (
                  <div className="fav-suggestions-dropdown">
                    {placeSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="fav-sug-item"
                        onClick={() => handleSelectPlace(item)}
                      >
                        <div className="fav-sug-icon">
                          {item.category === 'gps' ? '📍' : '🏛️'}
                        </div>
                        <div className="fav-sug-body">
                          <span className="fav-sug-title">{item.name}</span>
                          <span className="fav-sug-sub">{item.subtitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="fav-form-group">
              <label>Place Category</label>
              <div className="fav-mode-selector">
                {[
                  { id: 'home', label: 'Home', icon: Home },
                  { id: 'work', label: 'Work', icon: Briefcase },
                  { id: 'school', label: 'School / College', icon: GraduationCap },
                  { id: 'station', label: 'Transit Hub', icon: Train },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`fav-mode-pill ${placeType === item.id ? 'active' : ''}`}
                      onClick={() => setPlaceType(item.id)}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fav-modal-actions">
              <button type="button" className="fav-btn-cancel" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="fav-btn-submit" disabled={isSaving}>
                {isSaving ? <Loader2 size={16} className="spinning" /> : isEditing ? <Check size={16} /> : <ShieldCheck size={16} />}
                <span>{isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Frequent Place'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
