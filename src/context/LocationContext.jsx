import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { reverseGeocode } from '../api/location';
import { updateUserLocation } from '../api/users';
import { useAuth } from './AuthContext';

const LocationContext = createContext(null);

const DEFAULT_CENTER = {
  lat: 22.7196,
  lng: 75.8577,
  label: 'Indore, Madhya Pradesh',
  isCustom: false,
};

function haversineMeters(lat1, lon1, lat2, lon2) {
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

export function LocationProvider({ children }) {
  const { user, isLoggedIn } = useAuth();
  const watchIdRef = useRef(null);
  const lastSavedCoordsRef = useRef({ lat: null, lng: null, time: 0 });
  const [deviceLocation, setDeviceLocation] = useState(() => {
    try {
      const lat = parseFloat(sessionStorage.getItem('its_device_lat') || sessionStorage.getItem('its_lat') || '');
      const lng = parseFloat(sessionStorage.getItem('its_device_lng') || sessionStorage.getItem('its_lng') || '');
      const locality = sessionStorage.getItem('its_device_locality') || '';
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, locality, permissionState: 'granted' };
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [selectedLocation, setSelectedLocation] = useState(() => {
    try {
      const saved = sessionStorage.getItem('its_selected_loc');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.lat != null && parsed?.lng != null) {
          return parsed;
        }
      }
      const lat = parseFloat(sessionStorage.getItem('its_lat') || '');
      const lng = parseFloat(sessionStorage.getItem('its_lng') || '');
      const locality = sessionStorage.getItem('its_device_locality') || '';
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, label: locality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`, isCustom: false };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CENTER;
  });

  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [permissionState, setPermissionState] = useState(() => {
    if (sessionStorage.getItem('its_device_lat')) return 'granted';
    return 'prompt';
  });

  const locatingRef = useRef(false);

  // Sync user location update with backend whenever authenticated
  const syncLocationWithBackend = useCallback(async (lat, lng) => {
    const token = localStorage.getItem('its_token');
    if (!token) return;
    try {
      await updateUserLocation(lat, lng);
    } catch (err) {
      console.warn('Failed to save location to backend:', err);
    }
  }, []);

  const requestDeviceLocation = useCallback((force = false) => {
    if (!force && locatingRef.current) return;
    locatingRef.current = true;
    setIsLocating(true);
    setLocationError(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      locatingRef.current = false;
      setIsLocating(false);
      setPermissionState('unavailable');
      setLocationError('Geolocation is not supported by your browser. Please search for your location manually.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locatingRef.current = false;
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;

        setPermissionState('granted');
        setLocationError(null);

        // Reverse-geocode to get friendly locality name
        let localityName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const rev = await reverseGeocode(latitude, longitude);
          if (rev?.displayName) {
            localityName = rev.locality || rev.city || rev.displayName.split(',')[0];
          }
        } catch {
          // fallback
        }

        const devLoc = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 0,
          locality: localityName,
          permissionState: 'granted',
        };

        setDeviceLocation(devLoc);

        try {
          sessionStorage.setItem('its_device_lat', String(latitude));
          sessionStorage.setItem('its_device_lng', String(longitude));
          sessionStorage.setItem('its_lat', String(latitude));
          sessionStorage.setItem('its_lng', String(longitude));
          sessionStorage.setItem('its_device_locality', localityName);
        } catch {
          // ignore
        }

        // If the user hasn't explicitly locked onto a custom search or if force is true,
        // center the selected location on the new device location
        setSelectedLocation((prev) => {
          if (force || !prev.isCustom) {
            sessionStorage.removeItem('its_selected_loc');
            return {
              lat: latitude,
              lng: longitude,
              label: localityName,
              isCustom: false,
            };
          }
          return prev;
        });

        syncLocationWithBackend(latitude, longitude);
      },
      (err) => {
        locatingRef.current = false;
        setIsLocating(false);
        if (err.code === 1) {
          // PERMISSION_DENIED
          setPermissionState('denied');
          setLocationError('Location permission denied. You can search for cities and localities manually in the search bar above.');
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          setPermissionState('unavailable');
          setLocationError('Device location is temporarily unavailable. Manual search remains fully functional.');
        } else {
          // TIMEOUT or unknown
          setPermissionState('unavailable');
          setLocationError('Location request timed out. Please try refreshing or search manually.');
        }
      },
      { timeout: 9000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, [syncLocationWithBackend]);

  // Check browser permission status if query API is supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        setPermissionState(status.state);
        status.onchange = () => {
          setPermissionState(status.state);
          if (status.state === 'granted') {
            requestDeviceLocation();
          }
        };
      }).catch(() => {
        // Permissions query not supported for geolocation
      });
    }
  }, [requestDeviceLocation]);

  // If already authenticated and cached location exists, immediately sync to database on mount
  useEffect(() => {
    if (isLoggedIn) {
      const savedLat = parseFloat(sessionStorage.getItem('its_device_lat') || sessionStorage.getItem('its_lat') || '');
      const savedLng = parseFloat(sessionStorage.getItem('its_device_lng') || sessionStorage.getItem('its_lng') || '');
      if (!isNaN(savedLat) && !isNaN(savedLng)) {
        syncLocationWithBackend(savedLat, savedLng);
      }
    }
  }, [isLoggedIn, syncLocationWithBackend]);

  // Prompt for GPS as soon as user logs in and continuously watch position & save to database
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    if (!isLoggedIn) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // Force prompt/fetch GPS location immediately on login
    requestDeviceLocation(true);

    // Continuous watchPosition to track live location & sync with database
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPermissionState('granted');
        setLocationError(null);

        setDeviceLocation((prev) => ({
          ...(prev || {}),
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 0,
          permissionState: 'granted',
        }));

        setSelectedLocation((prev) => {
          if (!prev || !prev.isCustom) {
            return {
              ...(prev || {}),
              lat: latitude,
              lng: longitude,
              isCustom: false,
            };
          }
          return prev;
        });

        const now = Date.now();
        const last = lastSavedCoordsRef.current;
        const timeElapsed = now - last.time;
        const distMeters =
          last.lat != null && last.lng != null
            ? haversineMeters(last.lat, last.lng, latitude, longitude)
            : 999999;

        // Continuously save to database on first callback, or if moved >= 10m, or every 20s
        if (last.lat == null || distMeters >= 10 || timeElapsed >= 20000) {
          lastSavedCoordsRef.current = { lat: latitude, lng: longitude, time: now };
          syncLocationWithBackend(latitude, longitude);
        }
      },
      (err) => {
        if (err.code === 1) {
          setPermissionState('denied');
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isLoggedIn, requestDeviceLocation, syncLocationWithBackend]);

  const selectLocation = useCallback(({ lat, lng, label }) => {
    const newLoc = {
      lat,
      lng,
      label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      isCustom: true,
    };
    setSelectedLocation(newLoc);
    try {
      sessionStorage.setItem('its_selected_loc', JSON.stringify(newLoc));
    } catch {
      // ignore
    }
  }, []);

  const resetToDeviceLocation = useCallback(() => {
    try {
      sessionStorage.removeItem('its_selected_loc');
    } catch {
      // ignore
    }
    if (deviceLocation) {
      setSelectedLocation({
        lat: deviceLocation.lat,
        lng: deviceLocation.lng,
        label: deviceLocation.locality || `${deviceLocation.lat.toFixed(4)}, ${deviceLocation.lng.toFixed(4)}`,
        isCustom: false,
      });
    } else {
      requestDeviceLocation(true);
    }
  }, [deviceLocation, requestDeviceLocation]);

  const clearLocationError = useCallback(() => {
    setLocationError(null);
  }, []);

  const value = {
    deviceLocation,
    selectedLocation,
    isLocating,
    locationError,
    permissionState,
    requestDeviceLocation,
    selectLocation,
    resetToDeviceLocation,
    clearLocationError,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useAppLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useAppLocation must be used within a LocationProvider');
  }
  return context;
}
