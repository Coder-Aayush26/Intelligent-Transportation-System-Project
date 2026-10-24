import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCurrentUser } from '../api/users';
import ProfileHeader from '../components/profile/ProfileHeader';
import ReliabilityScore from '../components/profile/ReliabilityScore';
import ActivityFeed from '../components/profile/ActivityFeed';
import EditProfileModal from '../components/profile/EditProfileModal';
import AvatarUploadModal from '../components/profile/AvatarUploadModal';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadProfile = useCallback(async () => {
    try {
      const data = await fetchCurrentUser();
      setProfile({
        id: data.id,
        name: data.name || authUser?.name || 'User',
        fullName: data.fullName || data.name || authUser?.name || 'User',
        email: data.email || authUser?.email || '',
        avatarUrl: data.avatarUrl || authUser?.avatarUrl || null,
        memberSince: data.memberSince || authUser?.memberSince || 'Recently joined',
        reliabilityScore: data.reliabilityScore ?? 3.0,
        reliabilityLabel: data.reliabilityLabel ?? 'New Member (No activity yet)',
        totalReports: data.totalReports ?? 0,
        totalVerifications: data.totalVerifications ?? 0,
        scoreFactors: data.scoreFactors || [],
        recentActivity: data.recentActivity || [],
      });
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      if (authUser) {
        setProfile({
          id: authUser.id,
          name: authUser.name,
          fullName: authUser.fullName || authUser.name,
          email: authUser.email,
          avatarUrl: authUser.avatarUrl || null,
          memberSince: authUser.memberSince || 'Recently joined',
          reliabilityScore: authUser.reliabilityScore ?? 3.0,
          reliabilityLabel: authUser.reliabilityLabel ?? 'New Member (No activity yet)',
          totalReports: 0,
          totalVerifications: 0,
          scoreFactors: ['Baseline score assigned upon account creation'],
          recentActivity: [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleProfileUpdated = (updated) => {
    setProfile((prev) => ({
      ...prev,
      name: updated.name,
      fullName: updated.fullName || updated.name,
    }));
    showToast('Profile name updated successfully!');
  };

  const handleAvatarUpdated = (newUrl) => {
    setProfile((prev) => ({
      ...prev,
      avatarUrl: newUrl,
    }));
    showToast(newUrl ? 'Profile picture updated successfully!' : 'Profile picture removed.');
  };

  if (loading && !profile) {
    return (
      <div className="profile-page">
        <p className="loading-state">Loading profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="detail-card">
          <p>No active profile session found. Please log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {toastMessage && (
        <div className="profile-toast-banner" role="status">
          ✓ {toastMessage}
        </div>
      )}

      <ProfileHeader
        user={profile}
        onEditProfile={() => setIsEditModalOpen(true)}
        onEditAvatar={() => setIsAvatarModalOpen(true)}
      />

      <ReliabilityScore user={profile} />

      <ActivityFeed activity={profile.recentActivity} />

      <EditProfileModal
        isOpen={isEditModalOpen}
        user={profile}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={handleProfileUpdated}
      />

      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        user={profile}
        onClose={() => setIsAvatarModalOpen(false)}
        onUpdated={handleAvatarUpdated}
      />
    </div>
  );
}
