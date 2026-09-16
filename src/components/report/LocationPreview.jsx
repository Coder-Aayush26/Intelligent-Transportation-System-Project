import './LocationPreview.css';

const CAPTURED_LOCATION = {
  lat: 22.7196,
  lng: 75.8577,
  timestamp: '23 May 2025, 04:35 PM',
};

export default function LocationPreview() {
  return (
    <div className="mini-map-card">
      <div className="mini-map">
        <svg width="100%" height="100%" viewBox="0 0 360 140" aria-hidden="true" style={{position:'absolute',inset:0}}>
          <rect width="360" height="140" fill="#eef3ff" />
          {[20,50,80,110,140].map(y => <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(37,99,235,0.07)" strokeWidth="1"/>)}
          {[40,80,120,160,200,240,280,320].map(x => <line key={x} x1={x} y1="0" x2={x} y2="140" stroke="rgba(37,99,235,0.07)" strokeWidth="1"/>)}
          <path d="M0,80 C100,55 230,105 360,75" stroke="#fff" strokeWidth="16" fill="none" strokeLinecap="round"/>
          <path d="M0,80 C100,55 230,105 360,75" stroke="rgba(37,99,235,0.3)" strokeWidth="1" strokeDasharray="8 6" fill="none"/>
          <line x1="200" y1="0" x2="200" y2="140" stroke="#fff" strokeWidth="14"/>
        </svg>
        <div className="mini-pin" aria-hidden="true" style={{position:'absolute'}}>📍</div>
      </div>
      <div className="mini-info">
        <div><b>Lat:</b> {CAPTURED_LOCATION.lat}, <b>Long:</b> {CAPTURED_LOCATION.lng}</div>
        <div><b>Time:</b> {CAPTURED_LOCATION.timestamp}</div>
      </div>
    </div>
  );
}
