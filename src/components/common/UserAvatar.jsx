import { useState } from 'react';
import './UserAvatar.css';

export default function UserAvatar({ user, avatarUrl, name, size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false);

  const url = avatarUrl || user?.avatarUrl;
  const displayName = name || user?.fullName || user?.name || 'User';

  const getInitials = (str) => {
    if (!str) return 'U';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  // Consistent background color generation from name
  const getBgColor = (str) => {
    const colors = [
      '#2563eb', // primary blue
      '#7c3aed', // purple
      '#059669', // emerald
      '#d97706', // amber
      '#dc2626', // rose
      '#0891b2', // cyan
      '#4f46e5', // indigo
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const hasValidImage = url && !imageError;
  const initials = getInitials(displayName);
  const bgColor = getBgColor(displayName);

  return (
    <div 
      className={`user-avatar user-avatar-${size} ${className}`}
      style={{ backgroundColor: hasValidImage ? 'transparent' : bgColor }}
      aria-label={`Avatar for ${displayName}`}
    >
      {hasValidImage ? (
        <img
          src={url}
          alt={displayName}
          className="user-avatar-img"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="user-avatar-initials">{initials}</span>
      )}
    </div>
  );
}
