import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { INCIDENT_CATEGORIES } from '../../data/mockData';
import { apiFetch } from '../../api/client';
import Button from '../common/Button';
import './ReportForm.css';

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const DEFAULT_ADDRESS = 'Indore, Madhya Pradesh';

export default function ReportForm({ onLocationAcquired }) {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  
  // Geolocation / Location state
  const [locLat, setLocLat] = useState(22.7196);
  const [locLng, setLocLng] = useState(75.8577);
  const [locAddress, setLocAddress] = useState(DEFAULT_ADDRESS);
  const [manualAddress, setManualAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Initialise default preview on mount without blocking on GPS
  useEffect(() => {
    onLocationAcquired?.({
      lat: locLat,
      lng: locLng,
      address: locAddress || DEFAULT_ADDRESS,
      timestamp: new Date().toLocaleString(),
    });
  }, []);

  const handleGetLocation = () => {
    setIsLocating(true);
    setError('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser. Please enter location manually.');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocLat(latitude);
        setLocLng(longitude);
        let resolvedAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            resolvedAddress = data.display_name || resolvedAddress;
          }
        } catch {
          // fallback
        }
        setLocAddress(resolvedAddress);
        setManualAddress('');
        onLocationAcquired?.({
          lat: latitude,
          lng: longitude,
          address: resolvedAddress,
          timestamp: new Date().toLocaleString(),
        });
        setIsLocating(false);
      },
      () => {
        setError('Unable to retrieve device GPS. Please type the location manually below.');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleManualAddressBlur = async () => {
    if (!manualAddress.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}`);
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          const first = list[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          setLocLat(lat);
          setLocLng(lng);
          setLocAddress(first.display_name);
          onLocationAcquired?.({
            lat,
            lng,
            address: first.display_name,
            timestamp: new Date().toLocaleString(),
          });
          return;
        }
      }
    } catch {
      // fallback
    }
    // If geocoding didn't match, keep user text with existing coords
    setLocAddress(manualAddress);
    onLocationAcquired?.({
      lat: locLat,
      lng: locLng,
      address: manualAddress,
      timestamp: new Date().toLocaleString(),
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const finalAddress = (locAddress || manualAddress || DEFAULT_ADDRESS).trim();

    let uploadedUrls = [];

    try {
      if (file) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', 'its_app_uploads');

          const uploadRes = await fetch('https://api.cloudinary.com/v1_1/hb0sukix/image/upload', {
            method: 'POST',
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.secure_url) {
              uploadedUrls.push(uploadData.secure_url);
            }
          }
        } catch (uploadErr) {
          console.warn('Cloudinary upload error:', uploadErr);
        }

        // Fallback: If Cloudinary did not supply a URL, encode file to base64 data URL so AI vision always runs
        if (uploadedUrls.length === 0) {
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            if (dataUrl) {
              uploadedUrls.push(dataUrl);
            }
          } catch (fileErr) {
            console.warn('Fallback base64 encoding failed:', fileErr);
          }
        }
      }

      await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({ 
          category, 
          severity: severity || 'Medium', 
          description,
          lat: locLat,
          lng: locLng,
          location: (finalAddress.split(',')[0] || 'Indore').trim(),
          full_location: finalAddress,
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
    setTimeout(() => navigate('/app/dashboard'), 1500);
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
            <strong>📍 Location:</strong> {locAddress}
            <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={isLocating}>
                {isLocating ? '📍 Locating...' : '📍 Use My Exact GPS'}
              </Button>
              <button 
                type="button" 
                onClick={() => { setLocAddress(''); setManualAddress(''); }}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}
              >
                ✏️ Enter Different Address
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={isLocating}>
              {isLocating ? '📍 Locating...' : '📍 Use My Current Location'}
            </Button>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>— or enter manually —</div>
            <input
              type="text"
              placeholder="e.g. Ring Road, Near City Mall, Indore"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onBlur={handleManualAddressBlur}
              style={{
                padding: '8px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg)',
              }}
            />
          </div>
        )}
        <div className="help-text">Location is captured from device GPS or manual street address</div>
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
