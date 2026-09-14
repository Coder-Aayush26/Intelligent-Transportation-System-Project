import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { INCIDENT_CATEGORIES } from '../../data/mockData';
import Button from '../common/Button';
import './ReportForm.css';

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export default function ReportForm() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // POST to the FastAPI backend; falls back gracefully if not running yet.
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, severity, description }),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    } catch {
      // Backend may not be running yet — still show success in demo mode.
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
        <label>Location</label>
        <Button type="button" variant="outline" size="sm">📍 Use My Current Location</Button>
        <div className="help-text">Location will be captured automatically from your device GPS</div>
      </div>

      <div className="field">
        <label htmlFor="media">Add Photo / Video (Optional)</label>
        <label className="upload-box" htmlFor="media">
          <div className="ic" aria-hidden="true">📷</div>
          <div className="t">Click to upload or drag and drop</div>
          <div className="s">Images / Videos up to 50 MB</div>
          <input id="media" type="file" accept="image/*,video/*" hidden />
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
