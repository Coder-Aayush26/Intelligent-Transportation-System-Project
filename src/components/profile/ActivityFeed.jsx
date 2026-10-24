import './ActivityFeed.css';

export default function ActivityFeed({ activity = [] }) {
  return (
    <div className="detail-card" style={{ marginTop: 18 }}>
      <h4 className="panel-heading">My Recent Activity</h4>
      {activity.map((item, idx) => (
        <div className="activity-row" key={item.text + idx}>
          <span>{item.text}</span>
          <span className="activity-time">{item.time}</span>
          <span className={`status-tag ${item.tone}`}>{item.status}</span>
        </div>
      ))}
      {activity.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
          No recent activity yet. When you report or verify incidents, they will appear here.
        </p>
      )}
    </div>
  );
}
