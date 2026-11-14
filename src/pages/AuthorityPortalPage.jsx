import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, AlertTriangle, Truck, CheckCircle2, Clock, 
  Filter, X, RefreshCw, Radio, UserCheck, Lock, Key, ArrowLeft,
  ExternalLink, Building2, Shield, Eye, ShieldAlert, LogOut, ChevronDown
} from 'lucide-react';
import { fetchAuthorityIncidents, updateIncidentResolution } from '../api/incidents';
import { verifyAuthorityAccess, loginAuthorityApi } from '../api/users';
import { useRealtime } from '../context/RealtimeContext';
import { useAuth } from '../context/AuthContext';
import { useAppLocation } from '../context/LocationContext';
import ConfirmModal from '../components/common/ConfirmModal';
import LocationPromptModal from '../components/common/LocationPromptModal';
import './AuthorityPortalPage.css';

const STATUS_TABS = [
  { key: 'all', label: 'All Incidents' },
  { key: 'active', label: 'Active Hazards' },
  { key: 'Dispatched', label: 'Crews Dispatched' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved & Cleared' },
  { key: 'False Alarm', label: 'False Alarms' },
];

const COMMON_ACTIONS = [
  'Traffic Police Patrol Deployed for Signal Control',
  'Emergency Tow Truck Dispatched to Clear Blockage',
  'PWD Road Repair & Pothole Crew Dispatched',
  'High-Capacity Dewatering Pump Activated',
  'Hazard Completely Cleared & Traffic Restored',
  'False Alarm / Duplicate Report Dismissed',
];

const VALID_PASSKEYS = ['ITS-OFFICIAL-2025', 'ADMIN2025', 'OFFICIAL123', 'MP-TRAFFIC-2025', 'INDORE-GOV'];

// Inactivity timeout default: 5 minutes (300 seconds)
const DEFAULT_TIMEOUT_SECONDS = 300;

export default function AuthorityPortalPage() {
  const { user, loginAuthority, updateAuthUser, logout } = useAuth();
  const { connectionStatus, subscribe } = useRealtime();
  const { isLocationPromptOpen, closeLocationPrompt } = useAppLocation();
  const navigate = useNavigate();

  // Role-based Access Control Check
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    if (['official', 'admin', 'authority', 'traffic_police', 'police', 'operator'].includes(role)) return true;
    const email = (user.email || '').toLowerCase();
    if (email.includes('admin') || email.includes('official') || email.includes('gov.in')) return true;
    return false;
  }, [user]);

  // Clearance Gate & Login State
  const [officerIdentifier, setOfficerIdentifier] = useState('');
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [deptInput, setDeptInput] = useState('Indore Traffic Police Control Room');
  const [badgeInput, setBadgeInput] = useState('IND-TP-01');
  const [verifyingClearance, setVerifyingClearance] = useState(false);
  const [clearanceError, setClearanceError] = useState(null);

  // Inactivity Auto-Lock State
  const [isLocked, setIsLocked] = useState(false);
  const [timeoutSetting, setTimeoutSetting] = useState(DEFAULT_TIMEOUT_SECONDS);
  const [secondsRemaining, setSecondsRemaining] = useState(DEFAULT_TIMEOUT_SECONDS);
  const [unlockPasskey, setUnlockPasskey] = useState('');
  const [unlockError, setUnlockError] = useState('');

  // Operations Dashboard State
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [savingResolution, setSavingResolution] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Modal form state
  const [modalStatus, setModalStatus] = useState('Dispatched');
  const [modalAction, setModalAction] = useState(COMMON_ACTIONS[0]);
  const [modalUnit, setModalUnit] = useState('UNIT-TP-01');
  const [modalNotes, setModalNotes] = useState('');

  // ──────────────────────────────────────────────────────────
  // Inactivity Auto-Lock Protocol
  // ──────────────────────────────────────────────────────────
  const resetInactivity = useCallback(() => {
    if (!isLocked) {
      setSecondsRemaining(timeoutSetting);
    }
  }, [isLocked, timeoutSetting]);

  useEffect(() => {
    if (!isAuthorized || isLocked) return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const onUserActivity = () => resetInactivity();

    activityEvents.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, onUserActivity));
      clearInterval(timer);
    };
  }, [isAuthorized, isLocked, resetInactivity]);

  const formatCountdown = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleUnlockConsole = (e) => {
    e.preventDefault();
    const entered = unlockPasskey.trim();
    if (VALID_PASSKEYS.includes(entered)) {
      setIsLocked(false);
      setUnlockPasskey('');
      setUnlockError('');
      setSecondsRemaining(timeoutSetting);
    } else {
      setUnlockError('Invalid authorization passkey. Unlock clearance denied.');
    }
  };

  // ──────────────────────────────────────────────────────────
  // Incidents Query & Real-time Subscriptions
  // ──────────────────────────────────────────────────────────
  const loadIncidents = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const data = await fetchAuthorityIncidents({
        status: activeTab === 'all' ? undefined : activeTab,
      });
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load authority incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAuthorized]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    const unsub1 = subscribe('incident_created', () => loadIncidents());
    const unsub2 = subscribe('incident_resolved', (updated) => {
      setIncidents((prev) =>
        prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
      );
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, loadIncidents]);

  const handleOpenResolutionModal = (inc) => {
    setSelectedIncident(inc);
    setModalStatus(inc.status || 'Dispatched');
    setModalAction(inc.actionTaken || COMMON_ACTIONS[0]);
    setModalUnit(inc.assignedUnit || 'UNIT-TP-01');
    setModalNotes(inc.resolutionNotes || '');
  };

  const handleCloseModal = () => {
    setSelectedIncident(null);
  };

  const handleSubmitResolution = async (e) => {
    e.preventDefault();
    if (!selectedIncident) return;
    setSavingResolution(true);
    try {
      await updateIncidentResolution(selectedIncident.id, {
        status: modalStatus,
        action_taken: modalAction,
        assigned_unit: modalUnit,
        resolution_notes: modalNotes,
        is_active: !(modalStatus === 'Resolved' || modalStatus === 'False Alarm'),
      });
      setSelectedIncident(null);
      await loadIncidents();
    } catch (err) {
      alert(`Failed to update incident: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingResolution(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Official Clearance / Login Handler (Completely independent)
  // ──────────────────────────────────────────────────────────
  const handleVerifyClearance = async (e) => {
    e.preventDefault();
    const passkey = passkeyInput.trim();
    if (!passkey) {
      setClearanceError('Please enter your official municipal security passkey.');
      return;
    }
    setVerifyingClearance(true);
    setClearanceError(null);

    try {
      if (user) {
        // User already has a session -> elevate existing account
        const res = await verifyAuthorityAccess(passkey, deptInput, badgeInput);
        if (res && res.user) {
          updateAuthUser(res.user);
        } else {
          updateAuthUser({ role: 'official', authority_department: deptInput, badge_number: badgeInput });
        }
      } else {
        // User is NOT logged in -> authenticate or create official session directly
        const identifier = officerIdentifier.trim() || 'Officer_Control';
        await loginAuthority({
          identifier,
          password: passwordInput.trim() || 'Official@2025',
          passkey,
          department: deptInput,
          badgeNumber: badgeInput,
        });
      }
      setIsLocked(false);
      setSecondsRemaining(timeoutSetting);
    } catch (err) {
      setClearanceError(err.message || 'Invalid security passkey. Official administrative credentials required.');
    } finally {
      setVerifyingClearance(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  // ──────────────────────────────────────────────────────────
  // VIEW A: If user is NOT AUTHORIZED (or not logged in)
  // Standalone Official Government Clearance & Sign-In Terminal
  // ──────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="authority-portal-shell">
        <header className="auth-portal-header">
          <div className="auth-header-brand">
            <div className="auth-emblem">
              <Shield size={22} />
            </div>
            <div>
              <div className="auth-portal-gov-title">GOVERNMENT OF MADHYA PRADESH · MUNICIPAL TRANSPORTATION</div>
              <h1 className="auth-portal-main-title">Authority Operations Command Portal</h1>
            </div>
          </div>

          <div className="auth-header-actions">
            <Link to="/" className="auth-header-link" title="Return to Landing Page">
              <ArrowLeft size={16} />
              <span>Landing Page</span>
            </Link>
            <Link to="/app/dashboard" className="auth-header-link" title="Go to Public Citizen App">
              <ExternalLink size={15} />
              <span>Public Citizen App</span>
            </Link>
          </div>
        </header>

        <main className="auth-portal-main gate-center">
          <div className="standalone-gate-card">
            <div className="gate-lock-badge">
              <Lock size={36} />
            </div>

            <div className="gate-text-block">
              <span className="gate-classification-tag">RESTRICTED ACCESS · OFFICIAL CREDENTIALS ONLY</span>
              <h2>Administrative Operations Center</h2>
              <p>
                This terminal is reserved exclusively for Indore Traffic Police Control Room, 
                Municipal PWD Road Engineers, and Emergency Medical & Fire Dispatch Personnel. 
                Citizen logins cannot access this command console.
              </p>
            </div>

            <form onSubmit={handleVerifyClearance} className="gate-auth-form">
              <div className="gate-form-heading">
                <Key size={18} color="#3b82f6" />
                <span>Official Authority Verification & Sign-In</span>
              </div>

              {clearanceError && (
                <div className="gate-error-banner">
                  <AlertTriangle size={16} />
                  <span>{clearanceError}</span>
                </div>
              )}

              {/* If user is not logged in, ask for officer identifier */}
              {!user && (
                <div className="gate-field">
                  <label htmlFor="auth-officer-id">Officer Identifier / Official Email</label>
                  <input
                    id="auth-officer-id"
                    type="text"
                    value={officerIdentifier}
                    onChange={(e) => setOfficerIdentifier(e.target.value)}
                    placeholder="e.g. Officer_Sharma or sharma@traffic.gov.in"
                    required
                  />
                </div>
              )}

              {user && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', fontSize: '0.8rem', color: '#1e40af', marginBottom: '14px' }}>
                  Logged in as: <strong>{user.name || user.email}</strong> (Requires Official Clearance)
                </div>
              )}

              <div className="gate-field">
                <label htmlFor="auth-passkey">Security Passkey / Authorization PIN</label>
                <input
                  id="auth-passkey"
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter official passkey (e.g. ITS-OFFICIAL-2025)"
                  required
                />
                <span className="gate-hint">
                  Demo Passkeys: <code>ITS-OFFICIAL-2025</code> or <code>ADMIN2025</code>
                </span>
              </div>

              <div className="gate-field">
                <label htmlFor="auth-dept">Municipal Agency / Department</label>
                <select
                  id="auth-dept"
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                >
                  <option value="Indore Traffic Police Control Room">Indore Traffic Police Control Room</option>
                  <option value="Municipal Corporation & PWD Road Engineering">Municipal Corporation & PWD</option>
                  <option value="Emergency Medical & Fire Services Dispatch">Emergency Medical & Fire Services</option>
                </select>
              </div>

              <div className="gate-field">
                <label htmlFor="auth-badge">Officer Call-sign / Badge ID</label>
                <input
                  id="auth-badge"
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="e.g. IND-TP-01"
                />
              </div>

              <div className="gate-buttons-row">
                <button type="submit" className="gate-submit-btn" disabled={verifyingClearance}>
                  {verifyingClearance ? 'Authenticating Clearance…' : 'Unlock Operations Console'}
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="gate-cancel-btn"
                    onClick={() => navigate('/')}
                  >
                    ← Back to Landing Page
                  </button>
                  <button
                    type="button"
                    className="gate-cancel-btn"
                    onClick={() => navigate('/app/dashboard')}
                  >
                    Public Citizen App →
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW B: AUTHORIZED ADMINISTRATIVE OFFICIAL / ADMIN
  // Standalone Operations Command Center + Inactivity Auto-Lock
  // ──────────────────────────────────────────────────────────
  const activeCount = incidents.filter((i) => i.isActive && i.status !== 'Resolved').length;
  const dispatchedCount = incidents.filter((i) => i.status === 'Dispatched' || i.status === 'In Progress').length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved' || !i.isActive).length;

  return (
    <div className="authority-portal-shell">
      {/* Government Command Header */}
      <header className="auth-portal-header">
        <div className="auth-header-brand">
          <div className="auth-emblem">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="auth-portal-gov-title">
              MUNICIPAL EMERGENCY OPERATIONS COMMAND PORTAL
            </div>
            <h1 className="auth-portal-main-title">
              City Traffic & Incident Dispatch Console
            </h1>
          </div>
        </div>

        <div className="auth-header-actions">
          {/* Real-time Link Status */}
          <div className={`auth-stream-pill status-${connectionStatus}`} title={`WebSocket Stream: ${connectionStatus}`}>
            <span className="auth-pulse-dot" />
            <span>{connectionStatus === 'connected' ? 'SECURE COMMAND LINK' : 'RECONNECTING…'}</span>
          </div>

          {/* Inactivity Auto-Lock Timer Pill */}
          <div
            className={`auth-autolock-pill ${secondsRemaining < 60 ? 'warning-timer' : ''}`}
            title="Console will automatically lock after inactivity for security"
          >
            <Clock size={13} />
            <span>Lock in: {formatCountdown(secondsRemaining)}</span>
          </div>

          {/* Officer Identity Tag */}
          <div className="officer-identity-pill">
            <UserCheck size={14} color="#10b981" />
            <div className="officer-info">
              <span className="officer-name">{user?.name || user?.email || 'Officer'}</span>
              <span className="officer-role">CLEARANCE: {(user?.role || 'OFFICIAL').toUpperCase()}</span>
            </div>
          </div>

          {/* Immediate Lock Button */}
          <button
            type="button"
            className="auth-header-lock-btn"
            onClick={() => setIsLocked(true)}
            title="Lock operations terminal immediately"
          >
            <Lock size={15} />
            <span>Lock Console</span>
          </button>

          {/* Switch to Public Citizen App */}
          <Link to="/app/dashboard" className="auth-header-link" title="Open public citizen dashboard">
            <ExternalLink size={15} />
            <span>Citizen App</span>
          </Link>

          {/* Sign Out */}
          <button
            type="button"
            className="auth-header-logout-btn"
            onClick={() => setIsLogoutModalOpen(true)}
            title="Sign out of system"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Main Operations Body ── */}
      <main className="auth-portal-main">
        {/* Operations Overview Metric Cards */}
        <div className="portal-kpi-row">
          <div className="portal-kpi-card danger">
            <div className="kpi-icon-wrap danger">
              <AlertTriangle size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-label">Active Hazards</span>
              <span className="kpi-value">{activeCount}</span>
              <span className="kpi-desc">Requiring municipal response</span>
            </div>
          </div>

          <div className="portal-kpi-card warning">
            <div className="kpi-icon-wrap warning">
              <Truck size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-label">Dispatched Crews</span>
              <span className="kpi-value">{dispatchedCount}</span>
              <span className="kpi-desc">Field units deployed on-scene</span>
            </div>
          </div>

          <div className="portal-kpi-card success">
            <div className="kpi-icon-wrap success">
              <CheckCircle2 size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-label">Resolved & Cleared</span>
              <span className="kpi-value">{resolvedCount}</span>
              <span className="kpi-desc">Archived incidents today</span>
            </div>
          </div>

          <div className="portal-kpi-card info">
            <div className="kpi-icon-wrap info">
              <Building2 size={22} />
            </div>
            <div className="kpi-body">
              <span className="kpi-label">Active Response Units</span>
              <span className="kpi-value">8 Online</span>
              <span className="kpi-desc">Patrol & engineering crews</span>
            </div>
          </div>
        </div>

        {/* Command Queue & Dispatch Table */}
        <section className="portal-console-container">
          <div className="portal-console-toolbar">
            <div className="toolbar-left">
              <h2>Operations Queue & Response Dispatch</h2>
              <p>Review real-time citizen-reported incidents, dispatch field teams, and broadcast clearances.</p>
            </div>

            <div className="toolbar-right">
              <div className="timeout-selector-wrap">
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Auto-Lock:</span>
                <select
                  value={timeoutSetting}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTimeoutSetting(val);
                    setSecondsRemaining(val);
                  }}
                  className="timeout-select"
                >
                  <option value={180}>3 Minutes</option>
                  <option value={300}>5 Minutes</option>
                  <option value={600}>10 Minutes</option>
                  <option value={900}>15 Minutes</option>
                </select>
              </div>

              <button
                type="button"
                className="portal-refresh-btn"
                onClick={loadIncidents}
                title="Refresh incident list"
              >
                <RefreshCw size={14} />
                <span>Refresh Queue</span>
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="portal-tabs-bar">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`portal-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Incidents Table */}
          <div className="portal-table-wrapper">
            {loading ? (
              <div className="table-empty-state">
                <RefreshCw size={24} className="spin" />
                <span>Fetching live operational incidents…</span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="table-empty-state">
                <CheckCircle2 size={28} color="#10b981" />
                <span>No incidents pending in this status category.</span>
              </div>
            ) : (
              <table className="portal-grid-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Incident Category</th>
                    <th>Location / Corridor</th>
                    <th>Severity</th>
                    <th>Consensus</th>
                    <th>Assigned Crew</th>
                    <th>Reported Time</th>
                    <th>Operational Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((inc) => {
                    const statusKey = (inc.status || 'Active').toLowerCase().replace(' ', '-');
                    return (
                      <tr key={inc.id}>
                        <td>
                          <span className={`portal-status-pill status-${statusKey}`}>
                            {inc.status || (inc.isActive ? 'Active' : 'Resolved')}
                          </span>
                        </td>
                        <td>
                          <div className="inc-cat-title">{inc.category}</div>
                          {inc.description && (
                            <div className="inc-cat-desc">{inc.description}</div>
                          )}
                        </td>
                        <td>
                          <div className="inc-loc-primary">{inc.location}</div>
                          <div className="inc-loc-secondary">{inc.fullLocation}</div>
                        </td>
                        <td>
                          <span className={`portal-sev-badge sev-${(inc.severity || 'Medium').toLowerCase()}`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td>
                          <div className="consensus-cell">
                            <strong>{inc.confidence}%</strong>
                            <span className="consensus-count">({inc.verifications || 0} verifs)</span>
                          </div>
                        </td>
                        <td>
                          <span className="assigned-unit-tag">
                            {inc.assignedUnit || 'Unassigned'}
                          </span>
                        </td>
                        <td>
                          <div className="reported-time-cell">
                            {inc.reportedAt || inc.reportedTimeFull}
                          </div>
                        </td>
                        <td>
                          <div className="portal-table-actions">
                            <button
                              type="button"
                              className="btn-dispatch"
                              onClick={() => handleOpenResolutionModal(inc)}
                            >
                              Dispatch / Resolve
                            </button>
                            <button
                              type="button"
                              className="btn-inspect"
                              onClick={() => navigate(`/app/incidents/${inc.id}`)}
                              title="Inspect citizen report details"
                            >
                              <Eye size={13} />
                              <span>Inspect</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* ────────────────────────────────────────────────────────── */}
      {/* INACTIVITY AUTO-LOCK SCREEN OVERLAY                        */}
      {/* ────────────────────────────────────────────────────────── */}
      {isLocked && (
        <div className="portal-autolock-overlay">
          <div className="portal-autolock-modal">
            <div className="autolock-icon-pulse">
              <ShieldAlert size={40} />
            </div>

            <div className="autolock-content">
              <span className="autolock-badge">TERMINAL LOCKED · SECURITY PROTOCOL</span>
              <h2>Console Locked Due to Inactivity</h2>
              <p>
                To comply with municipal emergency command security standards, this console has locked 
                itself automatically. Please enter your authorization passkey to resume dispatch operations.
              </p>

              <div className="autolock-officer-card">
                <UserCheck size={18} color="#10b981" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    {user?.name || user?.email || 'Duty Officer'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {user?.authority_department || 'Indore Traffic Police Control Room'} · {user?.badge_number || 'IND-TP-01'}
                  </div>
                </div>
              </div>

              {unlockError && (
                <div className="gate-error-banner" style={{ textAlign: 'left', marginBottom: '12px' }}>
                  <AlertTriangle size={15} />
                  <span>{unlockError}</span>
                </div>
              )}

              <form onSubmit={handleUnlockConsole} className="autolock-form">
                <input
                  type="password"
                  value={unlockPasskey}
                  onChange={(e) => setUnlockPasskey(e.target.value)}
                  placeholder="Enter Security Passkey (e.g. ITS-OFFICIAL-2025)"
                  className="autolock-input"
                  autoFocus
                  required
                />

                <div className="autolock-actions-row">
                  <button type="submit" className="autolock-unlock-btn">
                    <Key size={15} />
                    <span>Unlock Terminal</span>
                  </button>
                  <button
                    type="button"
                    className="autolock-logout-btn"
                    onClick={handleConfirmLogout}
                  >
                    Exit & Sign Out
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch & Resolution Modal */}
      {selectedIncident && (
        <div className="portal-modal-backdrop" onClick={handleCloseModal}>
          <div className="portal-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <div className="modal-title-wrap">
                <Truck size={20} color="#3b82f6" />
                <div>
                  <h3>Dispatch & Resolution Console</h3>
                  <span className="modal-sub">Incident #{selectedIncident.id} · {selectedIncident.category}</span>
                </div>
              </div>
              <button type="button" className="portal-modal-close" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResolution}>
              <div className="portal-modal-body">
                <div className="incident-context-box">
                  <div className="context-row">
                    <strong>Location:</strong>
                    <span>{selectedIncident.fullLocation || selectedIncident.location}</span>
                  </div>
                  {selectedIncident.description && (
                    <div className="context-row">
                      <strong>Citizen Report:</strong>
                      <span>{selectedIncident.description}</span>
                    </div>
                  )}
                </div>

                <div className="portal-form-group">
                  <label htmlFor="res-status">Updated Incident Status</label>
                  <select
                    id="res-status"
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                  >
                    <option value="Active">Active (Under Review)</option>
                    <option value="Dispatched">Dispatched (Crews En Route)</option>
                    <option value="In Progress">In Progress (Work Underway)</option>
                    <option value="Resolved">Resolved (Hazard Cleared & Archived)</option>
                    <option value="False Alarm">False Alarm (Dismiss Report)</option>
                  </select>
                </div>

                <div className="portal-form-group">
                  <label htmlFor="res-action">Official Intervention / Action</label>
                  <select
                    id="res-action"
                    value={modalAction}
                    onChange={(e) => setModalAction(e.target.value)}
                  >
                    {COMMON_ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="portal-form-group">
                  <label htmlFor="res-unit">Assigned Emergency Response Unit</label>
                  <input
                    id="res-unit"
                    type="text"
                    value={modalUnit}
                    onChange={(e) => setModalUnit(e.target.value)}
                    placeholder="e.g. UNIT-TP-04 or PWD-CREW-02"
                  />
                </div>

                <div className="portal-form-group">
                  <label htmlFor="res-notes">Official Public Advisory / Clearance Notes</label>
                  <textarea
                    id="res-notes"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="Provide details of road clearance, lane reopening, or safety instructions for citizens..."
                  />
                </div>
              </div>

              <div className="portal-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-confirm" disabled={savingResolution}>
                  {savingResolution ? 'Broadcasting…' : 'Confirm & Broadcast Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Logout Modal */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Confirm Operational Sign Out"
        message="Are you sure you want to exit the Authority Command Center? Your active clearance will remain secured."
        confirmText="Sign Out"
        isDanger={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      {/* Post-Auth Location Access Dialog */}
      <LocationPromptModal
        isOpen={isAuthorized && isLocationPromptOpen}
        onClose={closeLocationPrompt}
      />
    </div>
  );
}
