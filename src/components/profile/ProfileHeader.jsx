import Button from '../common/Button';
import './ProfileHeader.css';

export default function ProfileHeader({ user }) {
  return (
    <div className="detail-card" style={{ marginBottom: 18 }}>
      <div className="profile-head">
        <div className="profile-avatar" aria-hidden="true">👤</div>
        <div style={{ flex: 1 }}>
          <h3 className="profile-name">{user.name}</h3>
          <div className="profile-meta">{user.email}</div>
          <div className="profile-meta">Member since {user.memberSince}</div>
        </div>
        <Button variant="outline" size="sm">Edit Profile</Button>
      </div>
    </div>
  );
}
