import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import './LocationPreview.css';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Recenter the map whenever the position changes */
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

export default function LocationPreview({ lat, lng, address, timestamp }) {
  // Fallback values when no prop is passed (e.g. default Indore coords)
  const displayLat = lat ?? 22.7196;
  const displayLng = lng ?? 75.8577;
  const displayTime = timestamp ?? new Date().toLocaleString();

  return (
    <div className="mini-map-card">
      <div className="mini-map">
        <MapContainer
          center={[displayLat, displayLng]}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[displayLat, displayLng]} />
          <Recenter lat={displayLat} lng={displayLng} />
        </MapContainer>
      </div>
      <div className="mini-info">
        <div>
          <b>Lat:</b> {displayLat.toFixed(5)}, <b>Long:</b> {displayLng.toFixed(5)}
        </div>
        <div><b>Time:</b> {displayTime}</div>
      </div>
      {address && (
        <div className="mini-address">📍 {address}</div>
      )}
    </div>
  );
}
