import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../api/incidents';
import { CATEGORY_STYLES } from '../data/mockData';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchNotifications();
        setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h2>Notifications</h2>
        <p>Real-time alerts for high-confidence incidents near you.</p>
      </div>

      {loading ? (
        <div className="loading-state">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">No new alerts at this time.</div>
      ) : (
        <div className="notifications-list">
          {notifications.map((inc) => {
            const style = CATEGORY_STYLES[inc.category] ?? CATEGORY_STYLES.Other;
            return (
              <div 
                key={inc.id} 
                className={`notification-card severity-${inc.severity.toLowerCase()}`}
                onClick={() => navigate(`/app/incidents/${inc.id}`)}
              >
                <div className="notif-icon" style={{ backgroundColor: style.color }}>
                  {style.icon}
                </div>
                <div className="notif-content">
                  <div className="notif-header">
                    <h4>{inc.category}</h4>
                    <span className="notif-time">{inc.reportedAt}</span>
                  </div>
                  <p className="notif-location">📍 {inc.fullLocation}</p>
                  <p className="notif-desc">{inc.description || 'No description provided.'}</p>
                  <div className="notif-meta">
                    <span className="conf-badge">Confidence: {inc.confidence}%</span>
                    <span className="verif-badge">Verifications: {inc.verifications}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
