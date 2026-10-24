import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchCurrentUser } from '../api/users';
import ProfileHeader from '../components/profile/ProfileHeader';
import ReliabilityScore from '../components/profile/ReliabilityScore';
import ActivityFeed from '../components/profile/ActivityFeed';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => {
        setProfile({
          id: data.id,
          name: data.name || authUser?.name || 'User',
          fullName: data.fullName || data.name || authUser?.name || 'User',
          email: data.email || authUser?.email || '',
          memberSince: data.memberSince || authUser?.memberSince || 'Recent',
          reliabilityScore: data.reliabilityScore ?? 3.0,
          reliabilityLabel: data.reliabilityLabel ?? 'New Member',
          scoreFactors: data.scoreFactors || [
            'Accurate Reports',
            'Helpful Verifications',
            'Timely Responses',
            'Community Feedback',
          ],
          recentActivity: data.recentActivity || [],
        });
      })
      .catch((err) => {
        console.error('Failed to fetch user profile:', err);
        // Fallback to authUser in context if API fails
        if (authUser) {
          setProfile({
            id: authUser.id,
            name: authUser.name,
            fullName: authUser.fullName || authUser.name,
            email: authUser.email,
            memberSince: authUser.memberSince || 'Recent',
            reliabilityScore: authUser.reliabilityScore ?? 3.0,
            reliabilityLabel: authUser.reliabilityLabel ?? 'New Member',
            scoreFactors: ['Accurate Reports', 'Helpful Verifications'],
            recentActivity: [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  if (loading && !profile) {
    return <div className="profile-page"><p>Loading profile…</p></div>;
  }

  if (!profile) {
    return <div className="profile-page"><p>No profile found. Please log in.</p></div>;
  }

  return (
    <div className="profile-page">
      <ProfileHeader user={{ name: profile.fullName, email: profile.email, memberSince: profile.memberSince }} />
      <ReliabilityScore user={profile} />
      <ActivityFeed activity={profile.recentActivity} />
    </div>
  );
}
