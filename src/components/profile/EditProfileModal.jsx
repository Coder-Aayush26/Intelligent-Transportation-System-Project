import { useState, useEffect } from 'react';
import Button from '../common/Button';
import { updateUserProfile } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import './EditProfileModal.css';

export default function EditProfileModal({ isOpen, user, onClose, onUpdated }) {
  const { updateAuthUser } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.fullName || user.name || '');
      setError('');
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Display name cannot be empty.');
      return;
    }
    if (trimmed.length > 60) {
      setError('Display name cannot exceed 60 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updated = await updateUserProfile({ name: trimmed, full_name: trimmed });
      updateAuthUser({ name: trimmed, fullName: trimmed });
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="modal-card edit-profile-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Profile</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={loading} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">
              Display Name <span className="req">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              maxLength={60}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-email" className="form-label">
              Email Address
            </label>
            <input
              id="edit-email"
              type="email"
              className="form-input read-only"
              value={user?.email || ''}
              readOnly
              disabled
            />
            <span className="form-hint">Email is tied to your account credentials and cannot be modified.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Membership Status</label>
            <div className="membership-pill">
              <span>Member since {user?.memberSince || 'Recent'}</span>
              <span className="membership-tag">{user?.reliabilityLabel || 'Active Member'}</span>
            </div>
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
