import { useEffect, useState } from 'react';
import { currentUser as mockUser } from '../data/mockData';
import { fetchCurrentUser } from '../api/users';
import ProfileHeader from '../components/profile/ProfileHeader';
import ReliabilityScore from '../components/profile/ReliabilityScore';
import ActivityFeed from '../components/profile/ActivityFeed';
import './ProfilePage.css';

export default function ProfilePage() {
  const [user, setUser] = useState(mockUser);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => {
        setUser({
          ...data,
          name: data.name,
          fullName: data.fullName ?? data.full_name ?? data.name,
          email: data.email,
          memberSince: data.memberSince ?? data.member_since,
          reliabilityScore: data.reliabilityScore ?? data.reliability_score ?? 3.0,
          reliabilityLabel: data.reliabilityLabel ?? data.reliability_label ?? 'Average',
          scoreFactors: data.scoreFactors ?? [],
          recentActivity: data.recentActivity ?? [],
        });
      })
      .catch(() => {
        // Keep mock user visible when the Render API is unavailable.
      });
  }, []);

  return (
    <div className="profile-page">
      <ProfileHeader user={{ name: user.fullName, email: user.email, memberSince: user.memberSince }} />
      <ReliabilityScore user={user} />
      <ActivityFeed activity={user.recentActivity} />
    </div>
  );
}
