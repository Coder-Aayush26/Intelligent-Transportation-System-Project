import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AlertTriangle, 
  ThumbsUp, 
  ThumbsDown, 
  HelpCircle, 
  X, 
  MapPin, 
  Clock, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Navigation, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { useAppLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { verifyIncident } from '../../api/incidents';
import { getNearbyEmergencyQueue, haversineMeters, formatDistance, isEmergencyIncident } from '../../services/emergencyRadar';
import './EmergencyVerificationCard.css';

// Synthesize pleasant emergency chime via Web Audio API
function playEmergencyChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Two-tone rising chime (659Hz -> 880Hz)
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio blocked or unsupported
  }
}

export default function EmergencyVerificationCard() {
  const { deviceLocation, selectedLocation, isLocationPromptOpen } = useAppLocation();
  const { user, isLoggedIn } = useAuth();
  const realtime = useRealtime();

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPaused, setIsPaused] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message, sub }
  const [hasPromptedThisSession, setHasPromptedThisSession] = useState(false);

  const timerRef = useRef(null);
  const activeIncident = queue[currentIndex] || null;

  // Active user voter coordinates
  const voterCoords = deviceLocation?.lat != null
    ? { lat: deviceLocation.lat, lng: deviceLocation.lng }
    : selectedLocation?.lat != null
    ? { lat: selectedLocation.lat, lng: selectedLocation.lng }
    : null;

  // Load emergency incidents within 1km
  const checkRadar = useCallback(async (forced = false) => {
    if (!isLoggedIn || isLocationPromptOpen || !voterCoords) return;

    try {
      const emergencies = await getNearbyEmergencyQueue({
        lat: voterCoords.lat,
        lng: voterCoords.lng,
        currentUser: user,
        maxRadiusKm: 1.0,
      });

      if (emergencies.length > 0) {
        setQueue(emergencies);
        setCurrentIndex(0);
        setTimeLeft(20);
        setShowPhoto(false);
        setFeedback(null);
        setIsOpen(true);
        playEmergencyChime();
        setHasPromptedThisSession(true);
      }
    } catch (err) {
      console.warn('Emergency radar check failed:', err);
    }
  }, [isLoggedIn, isLocationPromptOpen, voterCoords, user]);

  // Initial check triggered once location is ready and post-auth dialog has completed
  useEffect(() => {
    if (!isLoggedIn || isLocationPromptOpen || !voterCoords) return;
    if (hasPromptedThisSession) return;

    // Small delay to let UI settle smoothly
    const timer = setTimeout(() => {
      checkRadar();
    }, 1200);

    return () => clearTimeout(timer);
  }, [isLoggedIn, isLocationPromptOpen, voterCoords, hasPromptedThisSession, checkRadar]);

  // Subscribe to real-time incident_created events
  useEffect(() => {
    if (!realtime?.subscribe || !voterCoords) return;

    const unsubscribe = realtime.subscribe('incident_created', (newInc) => {
      if (!newInc || !isEmergencyIncident(newInc)) return;
      const incLat = newInc.coords?.lat ?? newInc.lat;
      const incLng = newInc.coords?.lng ?? newInc.lng;
      if (incLat == null || incLng == null) return;

      const dist = haversineMeters(voterCoords.lat, voterCoords.lng, Number(incLat), Number(incLng));
      if (dist <= 1000) {
        // New emergency reported near current user!
        const decorated = {
          ...newInc,
          distanceMeters: dist,
          distanceFormatted: formatDistance(dist),
        };
        setQueue((prev) => {
          const exists = prev.some((i) => i.id === decorated.id);
          if (exists) return prev;
          return [decorated, ...prev];
        });
        setIsOpen(true);
        setTimeLeft(20);
        playEmergencyChime();
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [realtime, voterCoords]);

  // Advance to next incident in queue or dismiss
  const advanceQueue = useCallback(() => {
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(20);
      setShowPhoto(false);
      setFeedback(null);
    } else {
      setIsOpen(false);
      setQueue([]);
      setCurrentIndex(0);
      setFeedback(null);
    }
  }, [currentIndex, queue.length]);

  // 20-Second Progress Bar Timer with Pause-on-Hover
  useEffect(() => {
    if (!isOpen || isPaused || isSubmitting || feedback) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (activeIncident) {
            try {
              sessionStorage.setItem(`its_skip_verif_${activeIncident.id}`, '1');
            } catch {
              // ignore
            }
          }
          advanceQueue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPaused, isSubmitting, feedback, activeIncident, advanceQueue]);

  // Action handlers
  const handleVote = async (verdict) => {
    if (!activeIncident || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await verifyIncident(activeIncident.id, verdict, voterCoords);

      try {
        localStorage.setItem(`its_vote_${activeIncident.id}`, verdict);
      } catch {
        // ignore
      }

      if (verdict === 'confirm') {
        setFeedback({
          type: 'confirm',
          message: 'Verification Confirmed!',
          sub: 'Thanks for keeping commuters safe. Reliability +0.1',
        });
      } else {
        setFeedback({
          type: 'contradict',
          message: 'Contradiction Recorded',
          sub: 'Road condition status updated for community drivers.',
        });
      }

      setTimeout(() => {
        setIsSubmitting(false);
        advanceQueue();
      }, 1300);
    } catch (err) {
      console.warn('Failed to verify incident:', err);
      setIsSubmitting(false);
      // If error (e.g. backend offline or distance mismatch), still save locally to avoid infinite loops
      try {
        sessionStorage.setItem(`its_skip_verif_${activeIncident.id}`, '1');
      } catch {
        // ignore
      }
      advanceQueue();
    }
  };

  const handleSkip = () => {
    if (!activeIncident) return;
    try {
      sessionStorage.setItem(`its_skip_verif_${activeIncident.id}`, '1');
    } catch {
      // ignore
    }
    advanceQueue();
  };

  const handleClose = () => {
    if (activeIncident) {
      try {
        sessionStorage.setItem(`its_skip_verif_${activeIncident.id}`, '1');
      } catch {
        // ignore
      }
    }
    setIsOpen(false);
    setQueue([]);
  };

  if (!isOpen || !activeIncident) return null;

  // Media preview logic
  const mediaUrl =
    activeIncident.mediaUrls?.[0] ||
    activeIncident.media_urls?.[0] ||
    activeIncident.mediaUrl ||
    null;

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / 20) * 100));

  return (
    <div
      className="emergency-radar-container"
      role="region"
      aria-label="Nearby Emergency Verification Alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="emergency-radar-card">
        {/* Progress bar countdown at top */}
        <div className="radar-progress-track">
          <div
            className={`radar-progress-fill ${isPaused ? 'paused' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Feedback Overlay upon Upvoting / Downvoting */}
        {feedback && (
          <div className={`radar-feedback-overlay ${feedback.type}`}>
            <div className="radar-feedback-content">
              {feedback.type === 'confirm' ? (
                <div className="feedback-icon confirm-glow">
                  <Sparkles size={28} />
                </div>
              ) : (
                <div className="feedback-icon contradict-glow">
                  <CheckCircle2 size={28} />
                </div>
              )}
              <h4 className="feedback-title">{feedback.message}</h4>
              <p className="feedback-sub">{feedback.sub}</p>
            </div>
          </div>
        )}

        {/* Card Header */}
        <div className="radar-card-header">
          <div className="radar-badge-group">
            <span className="radar-emergency-pill">
              <span className="radar-beacon-dot" />
              EMERGENCY CONFIRMATION
            </span>
            {queue.length > 1 && (
              <span className="radar-queue-pill">
                {currentIndex + 1} of {queue.length}
              </span>
            )}
          </div>
          <button
            type="button"
            className="radar-close-btn"
            onClick={handleClose}
            aria-label="Dismiss alert"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Proximity & Category Bar */}
        <div className="radar-meta-row">
          <span className="radar-cat-tag">
            {activeIncident.category || 'Accident'}
          </span>
          <span className="radar-distance-badge">
            <Navigation size={12} className="radar-nav-icon" />
            {activeIncident.distanceFormatted || 'Nearby (< 1km)'}
          </span>
          <span className="radar-time-badge">
            <Clock size={12} />
            {activeIncident.reportedAt || 'Just now'}
          </span>
        </div>

        {/* Location & Summary Body */}
        <div className="radar-card-body">
          <h4 className="radar-location-title">
            <MapPin size={16} className="radar-pin-icon" />
            <span>{activeIncident.location || 'Reported Location'}</span>
          </h4>

          {activeIncident.description && (
            <p className="radar-description-text">
              {activeIncident.description}
            </p>
          )}

          {/* Quick Scene Photo Peek */}
          {mediaUrl && (
            <div className="radar-photo-toggle-section">
              <button
                type="button"
                className="radar-photo-toggle-btn"
                onClick={() => setShowPhoto((prev) => !prev)}
              >
                {showPhoto ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPhoto ? 'Hide Scene Photo' : 'View Scene Evidence Photo'}</span>
              </button>
              {showPhoto && (
                <div className="radar-photo-preview-box">
                  <img
                    src={mediaUrl}
                    alt="Scene evidence"
                    className="radar-evidence-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Contextual Question */}
          <div className="radar-prompt-box">
            <AlertTriangle size={15} className="radar-prompt-icon" />
            <span>Are you near this location? Can you confirm this incident?</span>
          </div>
        </div>

        {/* Action Buttons: Upvote / Downvote / No Idea */}
        <div className="radar-actions-row">
          <button
            type="button"
            className="radar-action-btn btn-upvote"
            onClick={() => handleVote('confirm')}
            disabled={isSubmitting}
            title="Confirm this incident is active"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="spinner" />
            ) : (
              <ThumbsUp size={16} />
            )}
            <span className="btn-label-group">
              <strong>Upvote</strong>
              <small>Still There</small>
            </span>
          </button>

          <button
            type="button"
            className="radar-action-btn btn-downvote"
            onClick={() => handleVote('contradict')}
            disabled={isSubmitting}
            title="Contradict / Incident has cleared"
          >
            <ThumbsDown size={16} />
            <span className="btn-label-group">
              <strong>Downvote</strong>
              <small>Cleared / False</small>
            </span>
          </button>

          <button
            type="button"
            className="radar-action-btn btn-skip"
            onClick={handleSkip}
            disabled={isSubmitting}
            title="I don't know or can't see it"
          >
            <HelpCircle size={16} />
            <span className="btn-label-group">
              <strong>No Idea</strong>
              <small>Skip</small>
            </span>
          </button>
        </div>

        {/* Hover Hint & Timer Footnote */}
        <div className="radar-footer-row">
          <span className="radar-hover-hint">
            {isPaused ? '⏸️ Auto-dismiss paused' : `Auto-dismisses in ${timeLeft}s (hover to pause)`}
          </span>
        </div>
      </div>
    </div>
  );
}
