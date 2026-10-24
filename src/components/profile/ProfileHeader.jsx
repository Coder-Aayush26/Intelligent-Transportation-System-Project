import Button from '../common/Button';
import UserAvatar from '../common/UserAvatar';
import './ProfileHeader.css';

export default function ProfileHeader({ user, onEditProfile, onEditAvatar }) {
  const displayName = user?.fullName || user?.name || 'User';

  return (
    <div className="detail-card" style={{ marginBottom: 18 }}>
      <div className="profile-head">
        <div className="profile-avatar-wrap">
          <UserAvatar
            user={user}
            size="xl"
            name={displayName}
            className="profile-head-avatar"
          />
          <button
            type="button"
            className="avatar-edit-badge"
            onClick={onEditAvatar}
            title="Change Profile Photo"
            aria-label="Change Profile Photo"
          >
            📷
          </button>
        </div>

        <div className="profile-details-col">
          <div className="profile-title-row">
            <h3 className="profile-name">{displayName}</h3>
            {user?.reliabilityLabel && (
              <span className="profile-status-badge">{user.reliabilityLabel}</span>
            )}
          </div>
          <div className="profile-meta">✉ {user?.email || 'No email registered'}</div>
          <div className="profile-meta">📅 Member since {user?.memberSince || 'Recently joined'}</div>

          {(user?.totalReports !== undefined || user?.totalVerifications !== undefined) && (
            <div className="profile-stats-chips">
              <span className="profile-chip">
                📝 <b>{user?.totalReports ?? 0}</b> Reports Submitted
              </span>
              <span className="profile-chip">
                🔍 <b>{user?.totalVerifications ?? 0}</b> Community Verifications
              </span>
            </div>
          )}
        </div>

        <div className="profile-actions-col">
          <Button variant="outline" size="sm" onClick={onEditProfile}>
            ✏ Edit Profile
          </Button>
          <Button variant="outline" size="sm" onClick={onEditAvatar}>
            📷 Change Photo
          </Button>
        </div>
      </div>
    </div>
  );
}
