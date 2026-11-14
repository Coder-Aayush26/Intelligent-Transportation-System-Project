import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { INCIDENT_CATEGORIES } from '../../data/mockData';
import { apiFetch } from '../../api/client';
import { useAppLocation } from '../../context/LocationContext';
import Button from '../common/Button';
import './ReportForm.css';

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const DEFAULT_ADDRESS = 'Indore, Madhya Pradesh';

export default function ReportForm({ onLocationAcquired }) {
  const navigate = useNavigate();
  const { selectedLocation, deviceLocation } = useAppLocation();

  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);

  // Derive initial location from authenticated session
  const defaultLat = selectedLocation?.lat ?? deviceLocation?.lat ?? 22.7196;
  const defaultLng = selectedLocation?.lng ?? deviceLocation?.lng ?? 75.8577;
  const defaultAddress = selectedLocation?.label ?? deviceLocation?.locality ?? DEFAULT_ADDRESS;

  // Active location state (synchronized from session)
  const [locLat, setLocLat] = useState(defaultLat);
  const [locLng, setLocLng] = useState(defaultLng);
  const [locAddress, setLocAddress] = useState(defaultAddress);
  const [landmarkDetail, setLandmarkDetail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submissionResult, setSubmissionResult] = useState(null);
  const [nearbyDuplicateNotice, setNearbyDuplicateNotice] = useState(null);

  // Synchronize location whenever session or selected location updates
  useEffect(() => {
    const lat = selectedLocation?.lat ?? deviceLocation?.lat ?? 22.7196;
    const lng = selectedLocation?.lng ?? deviceLocation?.lng ?? 75.8577;
    const address = selectedLocation?.label ?? deviceLocation?.locality ?? DEFAULT_ADDRESS;
    setLocLat(lat);
    setLocLng(lng);
    setLocAddress(address);

    const combinedAddress = landmarkDetail.trim() ? `${landmarkDetail.trim()}, ${address}` : address;
    onLocationAcquired?.({
      lat,
      lng,
      address: combinedAddress,
      timestamp: new Date().toLocaleString(),
    });
  }, [selectedLocation, deviceLocation, landmarkDetail, onLocationAcquired]);

  // Check for nearby active incidents of the same category within ~100m
  useEffect(() => {
    let isCurrent = true;
    async function checkNearbyDuplicates() {
      if (!category || locLat == null || locLng == null) {
        setNearbyDuplicateNotice(null);
        return;
      }
      try {
        const incidents = await apiFetch(
          `/incidents/nearby?lat=${locLat}&lng=${locLng}&radius=0.15&category=${encodeURIComponent(category)}`
        );
        if (isCurrent) {
          if (Array.isArray(incidents) && incidents.length > 0) {
            setNearbyDuplicateNotice(incidents[0]);
          } else {
            setNearbyDuplicateNotice(null);
          }
        }
      } catch {
        if (isCurrent) setNearbyDuplicateNotice(null);
      }
    }
    const timer = setTimeout(checkNearbyDuplicates, 350);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [category, locLat, locLng]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    // Media is mandatory for Stage-1 AI assessment
    if (!file) {
      setError('Photo or video evidence is mandatory for Stage-1 AI assessment and manipulation screening.');
      setSubmitting(false);
      return;
    }

    const baseAddr = (locAddress || DEFAULT_ADDRESS).trim();
    const finalAddress = landmarkDetail.trim() ? `${landmarkDetail.trim()}, ${baseAddr}` : baseAddr;
    const shortLocation = (landmarkDetail.trim() || baseAddr.split(',')[0] || 'Current Location').trim();

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
          console.warn('Cloudinary upload error, using local base64 fallback:', uploadErr);
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

      const createdData = await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({ 
          category, 
          severity: severity || 'Medium', 
          description,
          lat: locLat,
          lng: locLng,
          location: shortLocation,
          full_location: finalAddress,
          media_urls: uploadedUrls 
        }),
      });
      setSubmissionResult(createdData);
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? submissionError.message
        : 'Unable to submit the report. Please try again.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setTimeout(() => navigate('/app/dashboard'), 2000);
  }

  if (success) {
    const isCorroborated = submissionResult?.isConsolidated || (submissionResult?.reportCount > 1);
    return (
      <div className="form-card">
        <div
          className="success-banner"
          style={isCorroborated ? { background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' } : undefined}
        >
          {isCorroborated ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 14 }}>📍 Report Corroborated & Consolidated!</div>
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.4 }}>
                An active <b>{submissionResult?.category}</b> incident was already active within 100 metres at <b>{submissionResult?.location}</b>.
                Your report has been associated as <b>Corroboration #{submissionResult?.reportCount}</b>, strengthening its confidence score.
              </div>
            </>
          ) : (
            '✅ Report submitted — entering automated assessment, then community verification.'
          )}
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

      {nearbyDuplicateNotice && (
        <div className="duplicate-alert-banner">
          <div className="duplicate-alert-title">
            <span>ℹ️ Active {nearbyDuplicateNotice.category} Detected Within 100m</span>
            <span className="duplicate-tag">{nearbyDuplicateNotice.reportCount || 1} report(s)</span>
          </div>
          <div className="duplicate-alert-body">
            An active incident is already reported at <b>{nearbyDuplicateNotice.location}</b>.
            Submitting your report here will automatically corroborate and reinforce this existing incident.
          </div>
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
        <label>Incident Location <span className="req">*</span></label>
        <div className="location-session-card">
          <div className="location-session-top">
            <span className="location-session-pill">
              {deviceLocation ? '📍 GPS Verified' : '📍 Session Location'}
            </span>
            <span className="location-session-note">
              Auto-captured from your authenticated session
            </span>
          </div>

          <div className="location-session-main">
            <div className="location-session-name">
              <strong>{locAddress}</strong>
            </div>
            <div className="location-session-coords">
              Coordinates: {locLat.toFixed(5)}, {locLng.toFixed(5)}
            </div>
          </div>

          <div className="location-session-landmark">
            <label htmlFor="landmark-input" className="landmark-label">
              Specific Landmark or Street Detail <span className="optional-tag">(Optional)</span>
            </label>
            <input
              id="landmark-input"
              type="text"
              className="landmark-input"
              placeholder="e.g. Opposite City Mall gate, Intersection of MG Road, Pillar #42"
              value={landmarkDetail}
              onChange={(e) => setLandmarkDetail(e.target.value)}
            />
            <div className="help-text">
              Location coordinates are already secured from your login session. Add specific landmark details if relevant.
            </div>
          </div>
        </div>
      </div>

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
          <label htmlFor="media" style={{ margin: 0 }}>
            Photo / Video Evidence <span className="req">*</span>
          </label>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neon)', background: 'rgba(37, 99, 235, 0.08)', padding: '2px 8px', borderRadius: 12 }}>
            🛡️ Required for Stage-1 AI Screening
          </span>
        </div>
        <label className="upload-box" htmlFor="media" style={{ borderColor: file ? 'var(--blue)' : 'var(--border)' }}>
          <div className="ic" aria-hidden="true">{file ? '✅' : '📷'}</div>
          <div className="t">{file ? file.name : 'Click to upload scene photo or video (Mandatory)'}</div>
          <div className="s">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB attached` : 'Upload image/video up to 50 MB for AI Authenticity Screening'}</div>
          <input 
            id="media" 
            type="file" 
            accept="image/*,video/*" 
            required
            hidden 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setError('');
              }
            }}
          />
        </label>
        <div className="help-text">
          Stage 1 requires media to screen for digital manipulation and verify scene authenticity. Community voting unlocks only after AI verifies this upload.
        </div>
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
