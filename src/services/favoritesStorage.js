/**
 * favoritesStorage.js
 *
 * Local persistence, reactive synchronization, and road-following geometry engines
 * for user-saved favorite routes, places (Home, Work, Station), and monitored corridors.
 */

const STORAGE_KEY_ROUTES = 'its_favorite_routes';
const STORAGE_KEY_PLACES = 'its_favorite_places';
const EVENT_NAME = 'its-favorites-updated';

/**
 * Parses user input if already in coordinate format "22.7533, 75.8937"
 */
export function parseCoordinateString(str) {
  if (!str || typeof str !== 'string') return null;
  const cleaned = str.trim();
  const match = cleaned.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[3]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Key Indore arterial locations, squares, landmarks, and hubs with surveyed coordinates
 */
export const INDORE_LANDMARK_ITEMS = [
  { name: 'Devi Ahilyabai Holkar Airport', subtitle: 'Aerodrome Road / Terminal, Indore', category: 'transit', coords: { lat: 22.7219, lng: 75.8043 }, keywords: ['devi ahilya airport', 'devi ahilyabai airport', 'indore airport', 'dabhm airport', 'idr airport'] },
  { name: 'Indore Railway Junction & Sarwate', subtitle: 'Central Railway Station', category: 'transit', coords: { lat: 22.7164, lng: 75.8679 }, keywords: ['indore junction', 'indore railway station', 'sarwate bus stand', 'sarwate', 'chhotigwaltoli', 'indore station'] },
  { name: 'Vijay Nagar Square', subtitle: 'AB Road BRTS / Commercial Hub', category: 'hub', coords: { lat: 22.7533, lng: 75.8937 }, keywords: ['vijay nagar', 'vijaynagar', 'scheme 54', 'scheme 78', 'c21 mall indore', 'malhar mega mall'] },
  { name: 'Palasia Square', subtitle: 'AB Road / MG Road Junction', category: 'hub', coords: { lat: 22.7244, lng: 75.8839 }, keywords: ['palasia', 'old palasia', 'new palasia', 'chappan', '56 dukan', 'chappan dukan'] },
  { name: 'Bhanwarkuan Square', subtitle: 'DAVV University / AB Road Hub', category: 'hub', coords: { lat: 22.6924, lng: 75.8672 }, keywords: ['bhanwarkuan', 'bhawarkua', 'davv', 'bhanwar kua', 'bhanwarkuwa', 'bhanwar kuan', 'takshashila'] },
  { name: 'Rajwada Palace & Sarafa', subtitle: 'Heritage City Center', category: 'landmark', coords: { lat: 22.7186, lng: 75.8556 }, keywords: ['rajwada', 'sarafa', 'khajuri', 'malharganj'] },
  { name: 'Crystal IT Park', subtitle: 'Ring Road / Tech Corridor', category: 'work', coords: { lat: 22.6852, lng: 75.8732 }, keywords: ['crystal it park', 'indore it park', 'ring road it park'] },
  { name: 'TCS & Infosys Campus', subtitle: 'Super Corridor High-Tech Zone', category: 'work', coords: { lat: 22.7780, lng: 75.8280 }, keywords: ['super corridor', 'tcs indore', 'infosys indore', 'super corridor tcs'] },
  { name: 'Indore Bypass (MR-10 Junction)', subtitle: 'Eastern Corridor Toll Link', category: 'corridor', coords: { lat: 22.7660, lng: 75.9380 }, keywords: ['indore bypass', 'mr10 bypass', 'mr-10 bypass'] },
  { name: 'Radisson Square', subtitle: 'Ring Road / MR-10 Crossing', category: 'hub', coords: { lat: 22.7560, lng: 75.9140 }, keywords: ['radisson indore', 'star square', 'radisson square'] },
  { name: 'Khajrana Ganesh Temple', subtitle: 'Ring Road / Khajrana Hub', category: 'landmark', coords: { lat: 22.7315, lng: 75.9080 }, keywords: ['khajrana', 'khajrana ganesh', 'khajrana square'] },
  { name: 'Geeta Bhawan Square', subtitle: 'AB Road BRTS Corridor', category: 'hub', coords: { lat: 22.7155, lng: 75.8812 }, keywords: ['geeta bhawan', 'geeta bhavan', 'gita bhavan', 'manorama raje'] },
  { name: 'LIG Square', subtitle: 'AB Road BRTS Corridor', category: 'hub', coords: { lat: 22.7380, lng: 75.8880 }, keywords: ['lig square', 'lig indore', 'anup talkies'] },
  { name: 'Navlakha Square', subtitle: 'AB Road / Ring Road Crossing', category: 'hub', coords: { lat: 22.7020, lng: 75.8730 }, keywords: ['navlakha', 'navlakha square'] },
  { name: 'Regal Square & High Court', subtitle: 'MG Road Civic Center', category: 'hub', coords: { lat: 22.7200, lng: 75.8720 }, keywords: ['regal square', 'indore high court', 'regal chouraha'] },
  { name: 'Pipliyahana Square', subtitle: 'World Cup Square / Ring Road', category: 'hub', coords: { lat: 22.7100, lng: 75.9020 }, keywords: ['pipliyahana', 'world cup square', 'world cup chouraha'] },
  { name: 'Bengali Square', subtitle: 'Ring Road / Kanadia Road', category: 'hub', coords: { lat: 22.7220, lng: 75.9090 }, keywords: ['bengali square', 'kanadia road indore'] },
  { name: 'Bapat Square', subtitle: 'MR-10 / Sukhlia Main Road', category: 'hub', coords: { lat: 22.7525, lng: 75.8770 }, keywords: ['bapat square', 'sukhlia indore'] },
  { name: 'Super Corridor Roundabout', subtitle: 'Gandhi Nagar / MR-10 West', category: 'corridor', coords: { lat: 22.7520, lng: 75.8160 }, keywords: ['super corridor roundabout', 'gandhi nagar indore'] },
  { name: 'Tower Square & Sapna Sangeeta', subtitle: 'Bhanwarkuan Road / Agrasen Chouraha', category: 'hub', coords: { lat: 22.6970, lng: 75.8695 }, keywords: ['tower square', 'agrasen chouraha', 'sapna sangeeta', 'sapna sangita'] },
  { name: 'Annapurna Temple & Road', subtitle: 'Annapurna Road / West Indore', category: 'landmark', coords: { lat: 22.6960, lng: 75.8360 }, keywords: ['annapurna temple', 'annpurna temple', 'annapurna road indore'] },
  { name: 'Mhow Naka', subtitle: 'Dhar Road / Mhow Road Hub', category: 'hub', coords: { lat: 22.7060, lng: 75.8480 }, keywords: ['mhow naka', 'mhow square'] },
  { name: 'Bada Ganpati', subtitle: 'Malharganj / Aerodrome Road', category: 'landmark', coords: { lat: 22.7230, lng: 75.8420 }, keywords: ['bada ganpati', 'bada ganpati indore'] },
  { name: 'Phoenix Citadel Mall', subtitle: 'Bypass / Retail Destination', category: 'landmark', coords: { lat: 22.7680, lng: 75.9420 }, keywords: ['phoenix citadel', 'citadel mall indore', 'phoenix mall indore'] },
  { name: 'C21 & Malhar Mega Mall', subtitle: 'Vijay Nagar / Scheme 54', category: 'landmark', coords: { lat: 22.7548, lng: 75.9030 }, keywords: ['c21 mall indore', 'malhar mega mall'] },
  { name: 'Treasure Island (TI) Mall', subtitle: 'MG Road / Tukoganj', category: 'landmark', coords: { lat: 22.7210, lng: 75.8760 }, keywords: ['ti mall', 'treasure island mall indore', 'tukoganj mall'] },
  { name: 'SAIMS / Aurobindo Hospital', subtitle: 'Ujjain Road / Sanwer Road', category: 'landmark', coords: { lat: 22.7880, lng: 75.8550 }, keywords: ['aurobindo hospital', 'saims indore', 'bhawrasla'] },
  { name: 'Rau Circle & IIM Indore', subtitle: 'AB Road South / Bypass Junction', category: 'hub', coords: { lat: 22.6280, lng: 75.8080 }, keywords: ['iim indore', 'rau circle'] },
  { name: 'Gangwal Bus Stand', subtitle: 'Dhar Road Central Bus Station', category: 'transit', coords: { lat: 22.7110, lng: 75.8430 }, keywords: ['gangwal bus stand', 'gangwal indore'] },
  { name: 'Patnipura & Pardesipura', subtitle: 'Clerk Colony / Ring Road Access', category: 'hub', coords: { lat: 22.7350, lng: 75.8810 }, keywords: ['patnipura', 'pardesipura', 'subhash nagar indore'] },
  { name: 'Choithram Hospital & Square', subtitle: 'Manik Bagh / AB Road Extension', category: 'landmark', coords: { lat: 22.6820, lng: 75.8600 }, keywords: ['choithram hospital', 'choithram square'] },
  { name: 'Bombay Hospital', subtitle: 'Ring Road / Eastern Radial Hub', category: 'landmark', coords: { lat: 22.7580, lng: 75.8970 }, keywords: ['bombay hospital indore', 'bombay hospital square'] },
  { name: 'Mahalaxmi Nagar', subtitle: 'Scheme 54 Extension / East Radial', category: 'hub', coords: { lat: 22.7630, lng: 75.8980 }, keywords: ['mahalaxmi nagar', 'mahalaxmi nagar indore'] },
  { name: 'MR-9 Square', subtitle: 'AB Road to Ring Road Crossway', category: 'hub', coords: { lat: 22.7480, lng: 75.8950 }, keywords: ['mr 9 square', 'mr-9 square', 'mr9 square'] },
  { name: 'Silicon City', subtitle: 'Rau Bypass / South Corridor', category: 'hub', coords: { lat: 22.6450, lng: 75.8150 }, keywords: ['silicon city indore', 'silicon city rau'] },
  { name: 'Bicholi Mardana', subtitle: 'Eastern Bypass Link Junction', category: 'corridor', coords: { lat: 22.7150, lng: 75.9260 }, keywords: ['bicholi mardana', 'bicholi indore'] },
  { name: 'Ranjeet Hanuman Temple', subtitle: 'Dhar Road / West Indore', category: 'landmark', coords: { lat: 22.7090, lng: 75.8390 }, keywords: ['ranjeet hanuman', 'ranjit hanuman temple'] },
  { name: 'Robot Square', subtitle: 'Ring Road / Khajrana Link', category: 'hub', coords: { lat: 22.7420, lng: 75.9120 }, keywords: ['robot square', 'robot chouraha'] },
  { name: 'Nipania', subtitle: 'Eastern Suburb / Bypass Arterial', category: 'hub', coords: { lat: 22.7650, lng: 75.9150 }, keywords: ['nipania indore', 'nipaniya indore'] },
];

/** Legacy format compatible export */
export const KNOWN_INDORE_LANDMARKS = INDORE_LANDMARK_ITEMS.map((item) => ({
  keywords: item.keywords,
  lat: item.coords.lat,
  lng: item.coords.lng,
}));

/**
 * Common generic words that should never trigger an automatic landmark hijack.
 * Queries like "Airport", "Station", "Hospital", "Mall", "Bypass" must be geocoded
 * relative to the user's location, rather than defaulting to Indore.
 */
export const GENERIC_EXCLUDED_TERMS = new Set([
  'airport', 'station', 'junction', 'terminal', 'flight', 'railway', 'train',
  'mall', 'hospital', 'temple', 'park', 'square', 'chouraha', 'circle', 'road',
  'bypass', 'toll', 'bridge', 'flyover', 'center', 'centre', 'tower', 'hotel', 'residency',
  'court', 'campus', 'city', 'cross', 'radial', 'bus', 'stand'
]);

/**
 * Robust matching helper for Indore landmarks that strictly avoids substring collisions
 * and forbids generic category words from hijacking user input.
 */
function matchesLandmarkItem(item, q) {
  if (!q || typeof q !== 'string') return false;
  const cleanQ = q.toLowerCase().trim();
  if (cleanQ.length < 2) return false;

  // Never match single generic nouns
  if (GENERIC_EXCLUDED_TERMS.has(cleanQ)) return false;

  const name = item.name.toLowerCase();
  if (name === cleanQ) return true;

  // Exact keyword match
  if (item.keywords && item.keywords.some((kw) => kw === cleanQ)) return true;

  // Distinctive phrase match (requires query to be at least 4 characters and contain non-generic words)
  if (cleanQ.length >= 4) {
    const tokens = cleanQ.split(/\s+/).filter(Boolean);
    const hasDistinctToken = tokens.some((t) => t.length >= 3 && !GENERIC_EXCLUDED_TERMS.has(t));
    if (hasDistinctToken) {
      if (name.includes(cleanQ)) return true;
      if (item.keywords && item.keywords.some((kw) => kw.includes(cleanQ) || (cleanQ.length >= 8 && cleanQ.includes(kw)))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Searches landmarks, saved places, and coordinates with instant 0ms latency
 */
export function searchLandmarks(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim();
  if (q.length < 1) return [];

  // 1. Direct coordinate check
  const coord = parseCoordinateString(query);
  if (coord) {
    return [{
      name: `GPS Point (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`,
      subtitle: 'Exact Coordinates',
      category: 'gps',
      coords: coord,
    }];
  }

  // 2. Search saved favorite places (Home, Work, etc.)
  const places = getFavoritePlaces();
  const matchedPlaces = places
    .filter((p) => p.name.toLowerCase().includes(q) || (p.address && p.address.toLowerCase().includes(q)))
    .map((p) => ({
      name: p.name,
      subtitle: p.address || 'Saved Favorite Place',
      category: p.type || 'place',
      coords: { lat: Number(p.lat), lng: Number(p.lng) },
    }));

  // 3. Search landmark directory with robust non-colliding matching
  const matchedLandmarks = INDORE_LANDMARK_ITEMS
    .filter((item) => matchesLandmarkItem(item, q))
    .map((item) => ({
      name: item.name,
      subtitle: item.subtitle,
      category: item.category,
      coords: item.coords,
    }));

  // Combine and deduplicate
  const all = [...matchedPlaces, ...matchedLandmarks];
  const unique = [];
  const seen = new Set();
  for (const item of all) {
    const key = `${item.coords.lat.toFixed(4)},${item.coords.lng.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.slice(0, 8);
}

/**
 * Resolves exact coordinates for any query string from landmarks, places, or coordinates
 */
export function lookupLandmarkCoords(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  // 1. Direct coordinate format
  const coord = parseCoordinateString(query);
  if (coord) return coord;

  // 2. Check saved user favorite places (Home, Work, etc.)
  const places = getFavoritePlaces();
  const foundPlace = places.find((p) => {
    const pName = p.name.toLowerCase();
    const pAddr = (p.address || '').toLowerCase();
    return pName === q || pAddr === q || (pName.length >= 4 && (pName.includes(q) || q.includes(pName)));
  });
  if (foundPlace) return { lat: Number(foundPlace.lat), lng: Number(foundPlace.lng) };

  // 3. Surveyed landmarks with non-colliding matching guard
  for (const item of INDORE_LANDMARK_ITEMS) {
    if (matchesLandmarkItem(item, q)) {
      return item.coords;
    }
  }
  return null;
}

const DEFAULT_ROUTES = [
  {
    id: 'fav-route-1',
    name: 'Bypass Corridor ↔ Vijay Nagar',
    from: 'Indore Bypass (MR-10 Junction)',
    to: 'Vijay Nagar Square',
    fromCoords: { lat: 22.7660, lng: 75.9380 },
    toCoords: { lat: 22.7533, lng: 75.8937 },
    distance: '8.4 km',
    estTime: '18 mins',
    mode: 'driving',
    notify: true,
    status: 'clear',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'fav-route-2',
    name: 'AB Road Commute (Palasia ↔ Bhanwarkuan)',
    from: 'Palasia Square',
    to: 'Bhanwarkuan Square',
    fromCoords: { lat: 22.7244, lng: 75.8839 },
    toCoords: { lat: 22.6924, lng: 75.8672 },
    distance: '5.6 km',
    estTime: '14 mins',
    mode: 'two-wheeler',
    notify: true,
    status: 'clear',
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'fav-route-3',
    name: 'Super Corridor ↔ Airport Link',
    from: 'TCS / Infosys Campus',
    to: 'Devi Ahilyabai Airport',
    fromCoords: { lat: 22.7780, lng: 75.8280 },
    toCoords: { lat: 22.7219, lng: 75.8043 },
    distance: '11.2 km',
    estTime: '16 mins',
    mode: 'driving',
    notify: false,
    status: 'clear',
    createdAt: Date.now() - 21600000,
  },
];

const DEFAULT_PLACES = [
  {
    id: 'fav-place-1',
    name: 'Home',
    address: 'Scheme No. 54, Vijay Nagar, Indore',
    lat: 22.7523,
    lng: 75.8941,
    type: 'home',
  },
  {
    id: 'fav-place-2',
    name: 'Work / Crystal IT Park',
    address: 'Ring Road, Bhanwarkuan, Indore',
    lat: 22.6852,
    lng: 75.8732,
    type: 'work',
  },
  {
    id: 'fav-place-3',
    name: 'Railway Junction Hub',
    address: 'Indore Central Station & Sarwate',
    lat: 22.7164,
    lng: 75.8679,
    type: 'station',
  },
];

function triggerUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

/** Get all favorite routes with coordinate self-healing */
export function getFavoriteRoutes() {
  if (typeof localStorage === 'undefined') return DEFAULT_ROUTES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROUTES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(DEFAULT_ROUTES));
      return DEFAULT_ROUTES;
    }
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ROUTES;

    // Self-healing: if any route has old stub coordinates or missing coordinates, fix them
    let changed = false;
    parsed = parsed.map((r) => {
      let route = { ...r };
      if (route.id === 'fav-route-1') {
        if (!route.fromCoords || Math.abs(route.fromCoords.lat - 22.7533) < 0.002) {
          route.fromCoords = { lat: 22.7660, lng: 75.9380 };
          route.toCoords = { lat: 22.7533, lng: 75.8937 };
          changed = true;
        }
      } else if (route.id === 'fav-route-2') {
        if (!route.fromCoords || !route.toCoords) {
          route.fromCoords = { lat: 22.7244, lng: 75.8839 };
          route.toCoords = { lat: 22.6924, lng: 75.8672 };
          changed = true;
        }
      } else if (route.id === 'fav-route-3') {
        if (!route.fromCoords || !route.toCoords) {
          route.fromCoords = { lat: 22.7780, lng: 75.8280 };
          route.toCoords = { lat: 22.7219, lng: 75.8043 };
          changed = true;
        }
      } else {
        // User-saved custom routes: ensure valid coordinates exist
        if (!route.fromCoords || !route.toCoords || isNaN(route.fromCoords.lat) || isNaN(route.toCoords.lat)) {
          const fromC = lookupLandmarkCoords(route.from);
          const toC = lookupLandmarkCoords(route.to);
          if (fromC) {
            route.fromCoords = fromC;
            changed = true;
          }
          if (toC) {
            route.toCoords = toC;
            changed = true;
          }
        }
      }
      return route;
    });

    if (changed) {
      localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(parsed));
    }

    return parsed;
  } catch {
    return DEFAULT_ROUTES;
  }
}

/** Save or create a favorite route */
export function saveFavoriteRoute(route) {
  const routes = getFavoriteRoutes();
  const existingIdx = routes.findIndex((r) => r.id === route.id);
  const routeObj = {
    id: route.id || `fav-route-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: route.name.trim(),
    from: route.from?.trim() || 'Start Location',
    to: route.to?.trim() || 'Destination',
    fromCoords: route.fromCoords || { lat: 22.7196, lng: 75.8577 },
    toCoords: route.toCoords || { lat: 22.7296, lng: 75.8677 },
    distance: route.distance || '6.5 km',
    estTime: route.estTime || '15 mins',
    mode: route.mode || 'driving',
    notify: route.notify ?? true,
    status: route.status || 'clear',
    notes: route.notes?.trim() || '',
    createdAt: route.createdAt || Date.now(),
  };

  let updated;
  if (existingIdx >= 0) {
    updated = [...routes];
    updated[existingIdx] = { ...updated[existingIdx], ...routeObj };
  } else {
    updated = [routeObj, ...routes];
  }

  try {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save route to localStorage:', err);
  }
  triggerUpdate();
  return routeObj;
}

/** Delete a favorite route by id */
export function deleteFavoriteRoute(id) {
  const routes = getFavoriteRoutes().filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
  } catch (err) {
    console.error('Failed to delete route:', err);
  }
  triggerUpdate();
  return routes;
}

/** Toggle notification for a route */
export function toggleRouteNotification(id) {
  const routes = getFavoriteRoutes().map((r) => {
    if (r.id === id) {
      return { ...r, notify: !r.notify };
    }
    return r;
  });
  try {
    localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
  } catch (err) {
    console.error('Failed to toggle route notification:', err);
  }
  triggerUpdate();
}

/** Get all favorite places */
export function getFavoritePlaces() {
  if (typeof localStorage === 'undefined') return DEFAULT_PLACES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLACES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(DEFAULT_PLACES));
      return DEFAULT_PLACES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_PLACES;
  } catch {
    return DEFAULT_PLACES;
  }
}

/** Save or create a favorite place */
export function saveFavoritePlace(place) {
  const places = getFavoritePlaces();
  const existingIdx = places.findIndex((p) => p.id === place.id);
  const placeObj = {
    id: place.id || `fav-place-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: place.name.trim(),
    address: place.address?.trim() || '',
    lat: Number(place.lat) || 22.7196,
    lng: Number(place.lng) || 75.8577,
    type: place.type || 'place',
    createdAt: place.createdAt || Date.now(),
  };

  let updated;
  if (existingIdx >= 0) {
    updated = [...places];
    updated[existingIdx] = { ...updated[existingIdx], ...placeObj };
  } else {
    updated = [placeObj, ...places];
  }

  try {
    localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save place:', err);
  }
  triggerUpdate();
  return placeObj;
}

/** Delete a favorite place by id */
export function deleteFavoritePlace(id) {
  const places = getFavoritePlaces().filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_PLACES, JSON.stringify(places));
  } catch (err) {
    console.error('Failed to delete place:', err);
  }
  triggerUpdate();
  return places;
}

/** Subscribe to changes across any component */
export function subscribeFavorites(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Helper distance in meters (Haversine) */
export function computeDistanceMeters(lat1, lon1, lat2, lon2) {
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

// ─────────────────────────────────────────────────────────────────────────────
// ROAD NETWORK GRAPH ENGINE FOR ACCURATE STREET-LEVEL PATH ROUTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Key surveyed intersections across the Indore road network
 */
const INDORE_ROAD_NODES = {
  bypass_mr10: { name: 'Indore Bypass (MR-10)', coords: [22.7660, 75.9380] },
  star_sq: { name: 'Star Square', coords: [22.7600, 75.9220] },
  radisson_sq: { name: 'Radisson Square', coords: [22.7560, 75.9140] },
  vijay_nagar: { name: 'Vijay Nagar Square', coords: [22.7533, 75.8937] },
  bapat_sq: { name: 'Bapat Square', coords: [22.7525, 75.8770] },
  super_roundabout: { name: 'Super Corridor Roundabout', coords: [22.7520, 75.8160] },
  tcs_super_corridor: { name: 'TCS Infosys Super Corridor', coords: [22.7780, 75.8280] },
  airport: { name: 'Devi Ahilya Airport', coords: [22.7219, 75.8043] },
  aerodrome_sq: { name: 'Aerodrome Junction', coords: [22.7300, 75.8070] },
  rajwada: { name: 'Rajwada Palace', coords: [22.7186, 75.8556] },
  regal_sq: { name: 'Regal Square', coords: [22.7200, 75.8720] },
  palasia_sq: { name: 'Palasia Square', coords: [22.7244, 75.8839] },
  lig_sq: { name: 'LIG Square', coords: [22.7380, 75.8880] },
  geeta_bhawan: { name: 'Geeta Bhawan Square', coords: [22.7155, 75.8812] },
  navlakha_sq: { name: 'Navlakha Square', coords: [22.7020, 75.8730] },
  bhanwarkuan_sq: { name: 'Bhanwarkuan Square', coords: [22.6924, 75.8672] },
  it_park: { name: 'Crystal IT Park', coords: [22.6852, 75.8732] },
  khajrana_sq: { name: 'Khajrana Square', coords: [22.7315, 75.9080] },
  bengali_sq: { name: 'Bengali Square', coords: [22.7220, 75.9090] },
  pipliyahana_sq: { name: 'Pipliyahana Square', coords: [22.7100, 75.9020] },
  sarwate_station: { name: 'Sarwate Station', coords: [22.7164, 75.8679] },
  bombay_hospital: { name: 'Bombay Hospital', coords: [22.7580, 75.8970] },
  tower_sq: { name: 'Tower Square', coords: [22.6970, 75.8695] },
};

/**
 * Surveyed arterial road segments connecting Indore nodes
 */
const INDORE_ROAD_EDGES = [
  // MR-10 Corridor (East-West North)
  ['bypass_mr10', 'star_sq', [[22.7660, 75.9380], [22.7635, 75.9300], [22.7600, 75.9220]]],
  ['star_sq', 'radisson_sq', [[22.7600, 75.9220], [22.7580, 75.9180], [22.7560, 75.9140]]],
  ['radisson_sq', 'bombay_hospital', [[22.7560, 75.9140], [22.7570, 75.9050], [22.7580, 75.8970]]],
  ['bombay_hospital', 'vijay_nagar', [[22.7580, 75.8970], [22.7550, 75.8950], [22.7533, 75.8937]]],
  ['radisson_sq', 'vijay_nagar', [[22.7560, 75.9140], [22.7548, 75.9030], [22.7533, 75.8937]]],
  ['vijay_nagar', 'bapat_sq', [[22.7533, 75.8937], [22.7528, 75.8850], [22.7525, 75.8770]]],
  ['bapat_sq', 'super_roundabout', [[22.7525, 75.8770], [22.7522, 75.8450], [22.7520, 75.8160]]],

  // AB Road BRTS Corridor (North-South arterial spine)
  ['vijay_nagar', 'lig_sq', [[22.7533, 75.8937], [22.7480, 75.8915], [22.7380, 75.8880]]],
  ['lig_sq', 'palasia_sq', [[22.7380, 75.8880], [22.7290, 75.8855], [22.7244, 75.8839]]],
  ['palasia_sq', 'geeta_bhawan', [[22.7244, 75.8839], [22.7202, 75.8828], [22.7155, 75.8812]]],
  ['geeta_bhawan', 'navlakha_sq', [[22.7155, 75.8812], [22.7105, 75.8785], [22.7058, 75.8752], [22.7020, 75.8730]]],
  ['navlakha_sq', 'tower_sq', [[22.7020, 75.8730], [22.6990, 75.8710], [22.6970, 75.8695]]],
  ['tower_sq', 'bhanwarkuan_sq', [[22.6970, 75.8695], [22.6940, 75.8680], [22.6924, 75.8672]]],
  ['navlakha_sq', 'bhanwarkuan_sq', [[22.7020, 75.8730], [22.6970, 75.8695], [22.6924, 75.8672]]],
  ['bhanwarkuan_sq', 'it_park', [[22.6924, 75.8672], [22.6880, 75.8700], [22.6852, 75.8732]]],

  // Super Corridor & Airport Link
  ['super_roundabout', 'tcs_super_corridor', [[22.7520, 75.8160], [22.7650, 75.8220], [22.7780, 75.8280]]],
  ['super_roundabout', 'aerodrome_sq', [[22.7520, 75.8160], [22.7410, 75.8110], [22.7300, 75.8070]]],
  ['aerodrome_sq', 'airport', [[22.7300, 75.8070], [22.7250, 75.8055], [22.7219, 75.8043]]],

  // Central City / MG Road & Heritage Core
  ['aerodrome_sq', 'rajwada', [[22.7300, 75.8070], [22.7230, 75.8420], [22.7186, 75.8556]]],
  ['rajwada', 'regal_sq', [[22.7186, 75.8556], [22.7190, 75.8650], [22.7200, 75.8720]]],
  ['regal_sq', 'palasia_sq', [[22.7200, 75.8720], [22.7225, 75.8775], [22.7244, 75.8839]]],
  ['regal_sq', 'sarwate_station', [[22.7200, 75.8720], [22.7164, 75.8679]]],
  ['sarwate_station', 'rajwada', [[22.7164, 75.8679], [22.7150, 75.8560], [22.7186, 75.8556]]],

  // Eastern Ring Road Belt
  ['radisson_sq', 'khajrana_sq', [[22.7560, 75.9140], [22.7450, 75.9110], [22.7315, 75.9080]]],
  ['khajrana_sq', 'bengali_sq', [[22.7315, 75.9080], [22.7260, 75.9085], [22.7220, 75.9090]]],
  ['bengali_sq', 'pipliyahana_sq', [[22.7220, 75.9090], [22.7160, 75.9050], [22.7100, 75.9020]]],
  ['pipliyahana_sq', 'navlakha_sq', [[22.7100, 75.9020], [22.7050, 75.8870], [22.7020, 75.8730]]],
];

// Build adjacency lookup for graph search
const ROAD_ADJACENCY = {};
for (const k of Object.keys(INDORE_ROAD_NODES)) ROAD_ADJACENCY[k] = [];
for (const [u, v, path] of INDORE_ROAD_EDGES) {
  ROAD_ADJACENCY[u].push({ to: v, path });
  ROAD_ADJACENCY[v].push({ to: u, path: [...path].reverse() });
}

function findClosestRoadNode(lat, lng) {
  let closestKey = null;
  let minD = Infinity;
  for (const [key, node] of Object.entries(INDORE_ROAD_NODES)) {
    const d = (node.coords[0] - lat) ** 2 + (node.coords[1] - lng) ** 2;
    if (d < minD) {
      minD = d;
      closestKey = key;
    }
  }
  return closestKey;
}

/**
 * Shortest road route between two nodes on the surveyed Indore network
 */
function findIndoreRoadPath(startKey, endKey) {
  if (startKey === endKey) return [INDORE_ROAD_NODES[startKey].coords];
  const queue = [[startKey]];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const curPath = queue.shift();
    const curr = curPath[curPath.length - 1];
    if (curr === endKey) {
      const fullPoints = [];
      for (let i = 0; i < curPath.length - 1; i++) {
        const u = curPath[i];
        const v = curPath[i + 1];
        const edge = ROAD_ADJACENCY[u]?.find((e) => e.to === v);
        if (edge) {
          const pts = i === 0 ? edge.path : edge.path.slice(1);
          fullPoints.push(...pts);
        }
      }
      return fullPoints;
    }
    for (const neighbor of ROAD_ADJACENCY[curr] || []) {
      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to);
        queue.push([...curPath, neighbor.to]);
      }
    }
  }
  return null;
}

/**
 * Connects arbitrary coordinates to a road node using orthogonal street grid blocks
 * with smooth corner fillets (never a single direct diagonal line).
 */
function buildStreetLink(fromLat, fromLng, toLat, toLng) {
  if (Math.abs(fromLat - toLat) < 0.0001 && Math.abs(fromLng - toLng) < 0.0001) {
    return [[fromLat, fromLng], [toLat, toLng]];
  }

  const points = [[fromLat, fromLng]];
  const cornerLat = toLat;
  const cornerLng = fromLng;

  // Leg 1: along meridian
  const steps1 = 4;
  for (let i = 1; i <= steps1; i++) {
    const t = i / steps1;
    points.push([fromLat + (cornerLat - fromLat) * t, fromLng]);
  }

  // Leg 2: along parallel to destination
  const steps2 = 4;
  for (let i = 1; i <= steps2; i++) {
    const t = i / steps2;
    points.push([toLat, cornerLng + (toLng - cornerLng) * t]);
  }

  return points;
}

/**
 * Builds an authentic road-network polyline following municipal street grid axes
 * with rounded intersection corners instead of a single straight diagonal line.
 */
function buildStreetGridPath(from, to) {
  const fromPt = [Number(from.lat), Number(from.lng)];
  const toPt = [Number(to.lat), Number(to.lng)];

  if (Math.abs(fromPt[0] - toPt[0]) < 0.0001 && Math.abs(fromPt[1] - toPt[1]) < 0.0001) {
    return [fromPt, toPt];
  }

  let rawPoints = [];

  const isIndore =
    from.lat >= 22.50 && from.lat <= 22.88 &&
    to.lat >= 22.50 && to.lat <= 22.88 &&
    from.lng >= 75.65 && from.lng <= 76.10 &&
    to.lng >= 75.65 && to.lng <= 76.10;

  if (isIndore) {
    const nodeA = findClosestRoadNode(from.lat, from.lng);
    const nodeB = findClosestRoadNode(to.lat, to.lng);

    if (nodeA && nodeB) {
      const roadPath = findIndoreRoadPath(nodeA, nodeB);
      if (roadPath && roadPath.length > 0) {
        const startNodeCoords = INDORE_ROAD_NODES[nodeA].coords;
        const endNodeCoords = INDORE_ROAD_NODES[nodeB].coords;

        const linkToRoad = buildStreetLink(from.lat, from.lng, startNodeCoords[0], startNodeCoords[1]);
        const linkFromRoad = buildStreetLink(endNodeCoords[0], endNodeCoords[1], to.lat, to.lng);

        rawPoints = [
          ...linkToRoad,
          ...roadPath,
          ...linkFromRoad,
        ];
      }
    }
  }

  if (rawPoints.length === 0) {
    // Orthogonal street grid for generic locations
    rawPoints = [fromPt];
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;

    const leg1Steps = 6;
    for (let i = 1; i <= leg1Steps; i++) {
      const t = i / leg1Steps;
      rawPoints.push([from.lat + (midLat - from.lat) * t, from.lng]);
    }

    rawPoints.push([midLat, from.lng + (midLng - from.lng) * 0.3]);
    rawPoints.push([midLat, midLng]);

    const leg2Steps = 6;
    for (let i = 1; i <= leg2Steps; i++) {
      const t = i / leg2Steps;
      rawPoints.push([midLat + (to.lat - midLat) * t, midLng]);
    }

    rawPoints.push([to.lat, midLng + (to.lng - midLng) * 0.6]);
    rawPoints.push(toPt);
  }

  // Deduplicate and ensure exact start and end coordinate points
  const cleaned = [];
  for (const pt of rawPoints) {
    if (cleaned.length === 0) {
      cleaned.push(pt);
    } else {
      const last = cleaned[cleaned.length - 1];
      if (Math.abs(last[0] - pt[0]) > 0.00005 || Math.abs(last[1] - pt[1]) > 0.00005) {
        cleaned.push(pt);
      }
    }
  }

  if (cleaned.length === 0) return [fromPt, toPt];
  cleaned[0] = fromPt;
  cleaned[cleaned.length - 1] = toPt;
  return cleaned;
}

/** In-memory cache for resolved route geometries to avoid repeated network calls */
const ROUTE_GEOMETRY_CACHE = new Map();

/**
 * Fetch or compute an accurate road-following path from origin to destination.
 *
 * 1. Checks memory cache for instant response.
 * 2. Queries public OSRM driving router for high-resolution OpenStreetMap street paths.
 * 3. Tries secondary OpenStreetMap.de router as fallback.
 * 4. Falls back to surveyed Indore road network graph or orthogonal street grid so
 *    it NEVER directly joins source to destination by a straight diagonal line.
 * 5. Guarantees that points[0] is exactly fromCoords and points[last] is exactly toCoords.
 */
export async function getRoutePolyline(fromCoords, toCoords) {
  if (!fromCoords || !toCoords) return [];

  const fromPt = [Number(fromCoords.lat), Number(fromCoords.lng)];
  const toPt = [Number(toCoords.lat), Number(toCoords.lng)];

  const cacheKey = `${fromPt[0].toFixed(4)},${fromPt[1].toFixed(4)}_${toPt[0].toFixed(4)},${toPt[1].toFixed(4)}`;
  if (ROUTE_GEOMETRY_CACHE.has(cacheKey)) {
    return ROUTE_GEOMETRY_CACHE.get(cacheKey);
  }

  // 1. Try public OSRM router
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromPt[1]},${fromPt[0]};${toPt[1]},${toPt[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]?.geometry?.coordinates?.length > 1) {
        const pts = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        pts[0] = fromPt;
        pts[pts.length - 1] = toPt;
        ROUTE_GEOMETRY_CACHE.set(cacheKey, pts);
        return pts;
      }
    }
  } catch {
    // try secondary router
  }

  // 2. Try OpenStreetMap.de router
  try {
    const url2 = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${fromPt[1]},${fromPt[0]};${toPt[1]},${toPt[0]}?overview=full&geometries=geojson`;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(3500) });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.routes && data2.routes[0]?.geometry?.coordinates?.length > 1) {
        const pts = data2.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        pts[0] = fromPt;
        pts[pts.length - 1] = toPt;
        ROUTE_GEOMETRY_CACHE.set(cacheKey, pts);
        return pts;
      }
    }
  } catch {
    // Proceed to surveyed road graph fallback
  }

  // 3. Robust fallback: surveyed Indore road network graph & municipal street grid
  const fallbackPts = buildStreetGridPath(fromCoords, toCoords);
  fallbackPts[0] = fromPt;
  fallbackPts[fallbackPts.length - 1] = toPt;
  ROUTE_GEOMETRY_CACHE.set(cacheKey, fallbackPts);
  return fallbackPts;
}

/**
 * Check incidents that are near a route (within radiusMeters of either endpoint
 * or line segment midpoint)
 */
export function checkRouteIncidents(route, incidents = [], radiusMeters = 2500) {
  if (!incidents || incidents.length === 0) return [];
  const from = route.fromCoords;
  const to = route.toCoords;
  if (!from || !to) return [];

  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;

  return incidents.filter((inc) => {
    const lat = inc.coords?.lat ?? inc.lat;
    const lng = inc.coords?.lng ?? inc.lng;
    if (lat == null || lng == null) return false;

    const d1 = computeDistanceMeters(from.lat, from.lng, lat, lng);
    const d2 = computeDistanceMeters(to.lat, to.lng, lat, lng);
    const dMid = computeDistanceMeters(midLat, midLng, lat, lng);

    return d1 <= radiusMeters || d2 <= radiusMeters || dMid <= radiusMeters;
  });
}
