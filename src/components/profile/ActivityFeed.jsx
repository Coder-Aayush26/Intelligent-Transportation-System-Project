import './ActivityFeed.css';

export default function ActivityFeed({ activity }) {
  return (
    <div className="detail-card" style={{ marginTop: 18 }}>
      <h4 className="panel-heading">My Recent Activity</h4>
      {activity.map((item) => (
        <div className="activity-row" key={item.text}>
          <span>{item.text}</span>
          <span className="activity-time">{item.time}</span>
          <span className={`status-tag ${item.tone}`}>{item.status}</span>
        </div>
      ))}
    </div>
  );
}
