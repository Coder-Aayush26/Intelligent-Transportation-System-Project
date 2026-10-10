import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INCIDENT_CATEGORIES } from '../../data/mockData';
import { apiFetch } from '../../api/client';
import Button from '../common/Button';
import './ReportForm.css';

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export default function ReportForm() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  
  // Geolocation state
  const [locLat, setLocLat] = useState(0);
  const [locLng, setLocLng] = useState(0);
  const [locAddress, setLocAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleGetLocation = () => {
    setIsLocating(true);
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocLat(latitude);
        setLocLng(longitude);
        try {
          // Reverse geocoding via OpenStreetMap (free, no key required)
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            setLocAddress(data.display_name || 'Unknown Location');
          } else {
            setLocAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (e) {
          setLocAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setIsLocating(false);
      },
      (err) => {
        setError('Unable to retrieve your location. Please check browser permissions.');
        setIsLocating(false);
      }
    );
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    let uploadedUrls = [];

    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'its_app_uploads'); // User's unsigned preset

        const uploadRes = await fetch('https://api.cloudinary.com/v1_1/hb0sukix/auto/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload media to Cloudinary');
        }
        
        const uploadData = await uploadRes.json();
        uploadedUrls.push(uploadData.secure_url);
      }

      await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({ 
          category, 
          severity, 
          description,
          lat: locLat,
          lng: locLng,
          location: locAddress ? locAddress.split(',')[0] : 'Unknown',
          full_location: locAddress || 'Unknown',
          media_urls: uploadedUrls 
        }),
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? submissionError.message
        : 'Unable to submit the report. Please try again.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    // Auto-redirect after 2 s so the user sees the confirmation.
    setTimeout(() => navigate('/app/dashboard'), 2000);
  }

  if (success) {
    return (
      <div className="form-card">
        <div className="success-banner">
          ✅ Report submitted — entering automated assessment, then community verification.
        </div>
        <p className="detail-desc" style={{ textAlign: 'center', marginBottom: 0 }}>
          Redirecting you to the live map…
        </p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
          ⚠ {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="category">
          Incident Category <span className="req">*</span>
        </label>
        <select
          id="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="" disabled>Select Category</option>
          {INCIDENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="severity">
          Severity Level <span className="req">*</span>
        </label>
        <select
          id="severity"
          required
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="" disabled>Select Severity</option>
          {SEVERITY_LEVELS.map((level) => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="description">
          Description <span className="req">*</span>
        </label>
        <textarea
          id="description"
          required
          placeholder="Describe the incident — what happened, how severe, which lanes are affected…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Location <span className="req">*</span></label>
        {locAddress ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, fontSize: 14, color: '#166534', marginBottom: 8 }}>
            <strong>📍 Location Acquired:</strong><br/>
            {locAddress}
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={isLocating}>
            {isLocating ? '📍 Locating...' : '📍 Use My Current Location'}
          </Button>
        )}
        <div className="help-text">Location will be captured automatically from your device GPS</div>
      </div>

      <div className="field">
        <label htmlFor="media">Add Photo / Video (Optional)</label>
        <label className="upload-box" htmlFor="media" style={{ borderColor: file ? 'var(--blue)' : 'var(--border)' }}>
          <div className="ic" aria-hidden="true">{file ? '✅' : '📷'}</div>
          <div className="t">{file ? file.name : 'Click to upload or drag and drop'}</div>
          {!file && <div className="s">Images / Videos up to 50 MB</div>}
          <input 
            id="media" 
            type="file" 
            accept="image/*,video/*" 
            hidden 
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
      </div>

      <div className="form-actions">
        <Button type="button" variant="outline" onClick={() => navigate('/app/dashboard')}>
          Cancel
        </Button>
        <Button type="submit" full disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
