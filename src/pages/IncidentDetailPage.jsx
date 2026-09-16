import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { incidents as mockIncidents } from '../data/mockData';
import { fetchIncident } from '../api/incidents';
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
      try {
        setIncident(await fetchIncident(id));
      } catch {
        setIncident(mockIncidents.find((item) => item.id === id) ?? null);
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
            We couldn't find that incident. It may have expired or been merged with another report.
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
          <IncidentHeader incident={incident} />
        </div>
        <div>
          <MediaGallery count={incident.mediaCount} />
          <VerificationSummary incident={incident} />
        </div>
      </div>
    </div>
  );
}
