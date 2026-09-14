// Mock data standing in for the FastAPI + PostgreSQL/PostGIS backend
// described in the ITS proposal. Swap fetchIncidents()/fetchUser() for
// real API calls once the backend exists — components only depend on
// the shapes below, not on how they're sourced.

export const CATEGORY_STYLES = {
  Accident: { color: 'var(--red)', bg: 'var(--red-light)', icon: '⚠' },
  Congestion: { color: 'var(--orange)', bg: 'var(--orange-light)', icon: '🚗' },
  Waterlogging: { color: 'var(--blue)', bg: 'var(--blue-light)', icon: '💧' },
  'Road Blockage': { color: 'var(--grey-ic)', bg: 'var(--grey-ic-light)', icon: '🚧' },
  Construction: { color: 'var(--grey-ic)', bg: 'var(--grey-ic-light)', icon: '🏗️' },
  'Local Event': { color: 'var(--green)', bg: 'var(--green-light)', icon: '👥' },
  Other: { color: 'var(--grey-ic)', bg: 'var(--grey-ic-light)', icon: '🚶' },
};

export const INCIDENT_CATEGORIES = [
  'Accident',
  'Congestion',
  'Waterlogging',
  'Road Blockage',
  'Construction',
  'Pothole / Road Damage',
  'Fire',
  'Local Event',
  'Other',
];

export const incidents = [
  {
    id: 'inc-1',
    category: 'Accident',
    location: 'Ring Road, Near City Mall',
    fullLocation: 'Ring Road, Near City Mall, Indore',
    coords: { lat: 22.7196, lng: 75.8577 },
    reportedAt: '2 mins ago',
    reportedTimeFull: '23 May 2025, 04:32 PM',
    severity: 'High',
    confidence: 92,
    reporter: 'Rahul23',
    description: 'Two vehicles collided near the City Mall. Heavy traffic on the route.',
    source: 'Mobile App',
    mediaCount: 2,
    verifications: 6,
    aiAssessment: 'Likely Real',
    nearbyVerifications: 5,
    contradictions: 0,
    avgReliability: 4.6,
    mapPosition: { top: '22%', left: '26%' },
  },
  {
    id: 'inc-2',
    category: 'Waterlogging',
    location: 'MG Road, Sector 12',
    fullLocation: 'MG Road, Sector 12, Indore',
    coords: { lat: 22.7241, lng: 75.8648 },
    reportedAt: '10 mins ago',
    reportedTimeFull: '23 May 2025, 04:24 PM',
    severity: 'Medium',
    confidence: 78,
    reporter: 'Priya_M',
    description: 'Standing water covering half the road after heavy rain, vehicles slowing to cross.',
    source: 'Mobile App',
    mediaCount: 1,
    verifications: 4,
    aiAssessment: 'Likely Real',
    nearbyVerifications: 3,
    contradictions: 0,
    avgReliability: 4.1,
    mapPosition: { top: '52%', left: '44%' },
  },
  {
    id: 'inc-3',
    category: 'Road Blockage',
    location: 'NH 48, Near Toll Plaza',
    fullLocation: 'NH 48, Near Toll Plaza, Indore',
    coords: { lat: 22.6981, lng: 75.8312 },
    reportedAt: '15 mins ago',
    reportedTimeFull: '23 May 2025, 04:19 PM',
    severity: 'Medium',
    confidence: 70,
    reporter: 'Amanj',
    description: 'Barricades placed after a truck breakdown, single lane open in each direction.',
    source: 'Web App',
    mediaCount: 0,
    verifications: 3,
    aiAssessment: 'Probable',
    nearbyVerifications: 2,
    contradictions: 1,
    avgReliability: 3.9,
    mapPosition: { top: '42%', left: '12%' },
  },
];

export const currentUser = {
  name: 'Aayush',
  fullName: 'Aayush Praveen',
  email: 'aayush@example.com',
  memberSince: 'May 2025',
  reliabilityScore: 4.6,
  reliabilityLabel: 'High Reliability',
  scoreFactors: ['Accurate Reports', 'Helpful Verifications', 'Timely Responses', 'Community Feedback'],
  recentActivity: [
    { text: 'Reported: Accident at Ring Road', time: '2 mins ago', status: 'Verified', tone: 'verified' },
    { text: 'Verified: Waterlogging on MG Road', time: '10 mins ago', status: 'Confirmed', tone: 'confirmed' },
    { text: 'Reported: Road Blockage on NH 48', time: '1 hour ago', status: 'Pending', tone: 'pending' },
  ],
};

export const dashboardStats = [
  { value: 24, label: 'Total Active Incidents', sub: 'Live updates' },
  { value: 16, label: 'High Confidence', sub: '> 80% confidence' },
  { value: 128, label: 'Reports Today', sub: 'From 98 users' },
  { value: 87, label: 'Verified Today', sub: '68% verified' },
];

export const mapLegend = [
  { label: 'Accident', color: 'var(--red)' },
  { label: 'Congestion', color: 'var(--orange)' },
  { label: 'Waterlogging', color: 'var(--blue)' },
  { label: 'Road Blockage', color: 'var(--grey-ic)' },
  { label: 'Construction', color: '#d1d5db' },
  { label: 'Other', color: '#d1d5db' },
];
