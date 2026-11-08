import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchIncident } from '../api/incidents';
import { incidents as mockIncidents } from '../data/mockData';
import IncidentHeader from '../components/incident/IncidentHeader';
import MediaGallery from '../components/incident/MediaGallery';
import VerificationSummary from '../components/incident/VerificationSummary';
import './IncidentDetailPage.css';

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchIncident(id);
        if (data) {
          setIncident(data);
          return;
        }
        const mock = mockIncidents.find((i) => i.id === id);
        setIncident(mock || null);
      } catch {
        const mock = mockIncidents.find((i) => i.id === id);
        setIncident(mock || null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div>
        <button className="back-link" onClick={() => navigate('/app/dashboard')}>← Back to Map</button>
        <div className="detail-card">
          <p className="detail-desc">Loading incident…</p>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div>
        <button className="back-link" onClick={() => navigate('/app/dashboard')}>← Back to Map</button>
        <div className="detail-card">
          <p className="detail-desc">
            We couldn't find that incident. It may have expired or been resolved.
          </p>
          <Link className="btn btn-outline btn-sm" to="/app/dashboard">Back to live map</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/app/dashboard')}>← Back to Map</button>
      <div className="detail-grid">
        <div>
          <IncidentHeader incident={incident} onIncidentUpdate={setIncident} />
        </div>
        <div>
          <MediaGallery count={incident.mediaCount} mediaUrls={incident.mediaUrls} />
          <VerificationSummary incident={incident} onIncidentUpdate={setIncident} />
        </div>
      </div>
    </div>
  );
}
