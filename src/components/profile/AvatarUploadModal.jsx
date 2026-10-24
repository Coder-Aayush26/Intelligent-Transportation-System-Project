import { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import UserAvatar from '../common/UserAvatar';
import { updateUserProfile } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import './AvatarUploadModal.css';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function AvatarUploadModal({ isOpen, user, onClose, onUpdated }) {
  const { updateAuthUser } = useAuth();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  // Clean up object URLs when modal closes or file changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setError('');
      setUploadProgress('');
    }
  }, [isOpen]);

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

  const handleFileChange = (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Unsupported file format. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError(`Image size exceeds ${MAX_SIZE_MB}MB. Please select a smaller photo.`);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError('');
    setUploadProgress('Uploading to secure cloud storage…');

    try {
      // Direct Cloudinary upload using existing unsigned preset
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('upload_preset', 'its_app_uploads');

      const res = await fetch('https://api.cloudinary.com/v1_1/hb0sukix/auto/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Image upload failed. Please verify your connection and try again.');
      }

      const data = await res.json();
      const secureUrl = data.secure_url;

      setUploadProgress('Persisting avatar to your profile…');

      // Persist to user record in MongoDB
      const updatedUser = await updateUserProfile({ avatar_url: secureUrl });
      updateAuthUser({ avatarUrl: secureUrl });

      onUpdated?.(updatedUser);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update avatar.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const handleRemoveAvatar = async () => {
    setLoading(true);
    setError('');
    setUploadProgress('Removing profile picture…');

    try {
      const updatedUser = await updateUserProfile({ avatar_url: '' });
      updateAuthUser({ avatarUrl: null });
      onUpdated?.(updatedUser);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const currentAvatarUrl = previewUrl || user?.avatarUrl;

  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="modal-card avatar-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Change Profile Picture</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={loading} aria-label="Close modal">
            ✕
          </button>
        </div>

        {error && <div className="modal-error-banner">⚠ {error}</div>}

        <div className="avatar-preview-container">
          <UserAvatar
            user={user}
            avatarUrl={currentAvatarUrl}
            size="xl"
            name={user?.fullName || user?.name}
          />
          <div className="avatar-preview-info">
            <span className="avatar-preview-name">{user?.fullName || user?.name || 'User'}</span>
            <span className="avatar-preview-hint">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'PNG, JPG, or WebP up to 5 MB'}
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={loading}
        />

        <div className="avatar-file-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            📁 Choose Image from Device
          </Button>

          {user?.avatarUrl && !selectedFile && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={loading}
              className="btn-remove-avatar"
            >
              🗑 Remove Picture
            </Button>
          )}
        </div>

        {uploadProgress && (
          <div className="upload-progress-indicator">
            <span className="spinner" /> {uploadProgress}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 24 }}>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!selectedFile || loading}
          >
            {loading ? 'Saving…' : 'Save Picture'}
          </Button>
        </div>
      </div>
    </div>
  );
}
