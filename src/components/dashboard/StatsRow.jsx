import { dashboardStats as mockStats } from '../../data/mockData';
import './StatsRow.css';

export default function StatsRow({ stats = mockStats }) {
  return (
    <div className="stat-row">
      {stats.map((stat) => (
        <div className="stat-cell" key={stat.label}>
          <div className="v">{stat.value}</div>
          <div className="l">{stat.label}</div>
          <div className="sub">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}
