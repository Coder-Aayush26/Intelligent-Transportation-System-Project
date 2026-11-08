import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, AlertTriangle, Truck, CheckCircle2, Clock, 
  Filter, X, RefreshCw, Radio, UserCheck, Lock, Key, ArrowLeft
} from 'lucide-react';
import { fetchAuthorityIncidents, updateIncidentResolution } from '../api/incidents';
import { verifyAuthorityAccess } from '../api/users';
import { useRealtime } from '../context/RealtimeContext';
import { useAuth } from '../context/AuthContext';
import './AuthorityDashboardPage.css';

const STATUS_TABS = [
  { key: 'all', label: 'All Incidents' },
  { key: 'active', label: 'Active Hazards' },
  { key: 'Dispatched', label: 'Crews Dispatched' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
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

export default function AuthorityDashboardPage() {
  const { user, updateAuthUser } = useAuth();
  const { subscribe } = useRealtime();
  const navigate = useNavigate();

  // Role-based Access Control Check
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    if (['official', 'admin', 'authority', 'traffic_police'].includes(role)) return true;
    const email = (user.email || '').toLowerCase();
    if (email.includes('admin') || email.includes('official') || email.includes('gov.in')) return true;
    return false;
  }, [user]);

  // Clearance Gate State
  const [passkeyInput, setPasskeyInput] = useState('');
  const [deptInput, setDeptInput] = useState('Indore Traffic Management Authority');
  const [badgeInput, setBadgeInput] = useState('OFFICIAL-01');
  const [verifyingClearance, setVerifyingClearance] = useState(false);
  const [clearanceError, setClearanceError] = useState(null);

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [savingResolution, setSavingResolution] = useState(false);

  // Modal form state
  const [modalStatus, setModalStatus] = useState('Dispatched');
  const [modalAction, setModalAction] = useState(COMMON_ACTIONS[0]);
  const [modalUnit, setModalUnit] = useState('UNIT-TP-01');
  const [modalNotes, setModalNotes] = useState('');

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

  // Real-time updates: refresh or patch live events
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

  const handleVerifyClearance = async (e) => {
    e.preventDefault();
    if (!passkeyInput.trim()) {
      setClearanceError('Please enter your official security passkey.');
      return;
    }
    setVerifyingClearance(true);
    setClearanceError(null);
    try {
      const res = await verifyAuthorityAccess(passkeyInput.trim(), deptInput, badgeInput);
      if (res && res.user) {
        updateAuthUser(res.user);
      } else {
        updateAuthUser({ role: 'official' });
      }
    } catch (err) {
      setClearanceError(err.message || 'Invalid security passkey. Official authority credentials required.');
    } finally {
      setVerifyingClearance(false);
    }
  };

  // If citizen or unauthorized, show the official clearance gate
  if (!isAuthorized) {
    return (
      <div className="authority-page">
        <div className="access-gate-container">
          <div className="access-gate-card">
            <div className="gate-icon-wrapper">
              <Lock size={32} />
            </div>

            <div>
              <h3>Restricted Authority Access</h3>
              <p>
                The City Traffic & Emergency Operations Portal is strictly reserved for authorized municipal officials, traffic police dispatchers, and emergency responders.
              </p>
            </div>

            <form onSubmit={handleVerifyClearance} className="clearance-form">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 600, fontSize: '0.86rem' }}>
                <Key size={16} color="#3b82f6" />
                <span>Enter Official Security Passkey</span>
              </div>

              {clearanceError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                  ⚠ {clearanceError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="auth-passkey">Security Passkey / Authorization PIN</label>
                <input
                  id="auth-passkey"
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter official passkey (e.g. ITS-OFFICIAL-2025)"
                  required
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Test passkeys: <code>ITS-OFFICIAL-2025</code> or <code>ADMIN2025</code>
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="auth-dept">Department / Municipal Agency</label>
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

              <div className="form-group">
                <label htmlFor="auth-badge">Officer Call-sign / Badge ID</label>
                <input
                  id="auth-badge"
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="e.g. IND-TP-04"
                />
              </div>

              <div className="gate-actions-row">
                <button type="submit" className="verify-btn" disabled={verifyingClearance}>
                  {verifyingClearance ? 'Verifying Credentials…' : 'Unlock Operations Console'}
                </button>
                <button
                  type="button"
                  className="back-map-btn"
                  onClick={() => navigate('/app/dashboard')}
                >
                  ← Return to Public Citizen Map
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // KPIs
  const activeCount = incidents.filter((i) => i.isActive && i.status !== 'Resolved').length;
  const dispatchedCount = incidents.filter((i) => i.status === 'Dispatched' || i.status === 'In Progress').length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved' || !i.isActive).length;

  return (
    <div className="authority-page">
      {/* Official Operations Command Banner */}
      <div className="authority-banner">
        <div className="auth-banner-left">
          <div className="auth-badge-icon">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2>City Traffic & Emergency Operations Portal</h2>
            <p>Official dispatch coordination, resolution clearance, and road safety enforcement center.</p>
          </div>
        </div>

        <div className="auth-banner-right">
          <div className="role-tag">
            <UserCheck size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Official Authority Access
          </div>
          <button
            type="button"
            className="export-btn"
            onClick={() => updateAuthUser({ role: 'citizen' })}
            title="Lock console and return to citizen mode"
          >
            <Lock size={14} />
            <span>Lock Console</span>
          </button>
          <button
            type="button"
            className="export-btn"
            onClick={loadIncidents}
            title="Refresh Operations Queue"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Operations Overview KPIs */}
      <div className="authority-kpi-grid">
        <div className="auth-kpi-card">
          <span className="auth-kpi-title">Active Hazards</span>
          <span className="auth-kpi-val" style={{ color: activeCount > 0 ? '#ef4444' : '#10b981' }}>
            {activeCount}
          </span>
          <span className="auth-kpi-sub">Requiring attention</span>
        </div>

        <div className="auth-kpi-card">
          <span className="auth-kpi-title">Dispatched Crews</span>
          <span className="auth-kpi-val" style={{ color: '#f59e0b' }}>
            {dispatchedCount}
          </span>
          <span className="auth-kpi-sub">Field units active</span>
        </div>

        <div className="auth-kpi-card">
          <span className="auth-kpi-title">Resolved & Cleared</span>
          <span className="auth-kpi-val" style={{ color: '#10b981' }}>
            {resolvedCount}
          </span>
          <span className="auth-kpi-sub">Archived resolutions</span>
        </div>

        <div className="auth-kpi-card">
          <span className="auth-kpi-title">Live Dispatch Units</span>
          <span className="auth-kpi-val" style={{ color: '#3b82f6' }}>
            8 Online
          </span>
          <span className="auth-kpi-sub">TP-01 to TP-08 ready</span>
        </div>
      </div>

      {/* Operations Incident Table & Actions */}
      <div className="authority-console-card">
        <div className="console-head">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
              Incident Queue & Dispatch Console
            </h3>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.84rem' }}>
              Select any incident to deploy emergency units, update status, and broadcast clearance to citizens.
            </p>
          </div>

          <div className="console-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`console-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="incidents-table-wrapper">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
              Loading operations queue…
            </div>
          ) : incidents.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
              No incidents found in this status category.
            </div>
          ) : (
            <table className="authority-inc-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Assigned Unit</th>
                  <th>Reported</th>
                  <th>Resolution / Action</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const statusKey = (inc.status || 'Active').toLowerCase().replace(' ', '-');
                  return (
                    <tr key={inc.id}>
                      <td>
                        <span className={`status-badge status-${statusKey}`}>
                          {inc.status || (inc.isActive ? 'Active' : 'Resolved')}
                        </span>
                      </td>
                      <td>
                        <strong>{inc.category}</strong>
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        <div>{inc.location}</div>
                        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                          {inc.fullLocation}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              inc.severity === 'Critical'
                                ? '#ef4444'
                                : inc.severity === 'High'
                                ? '#f97316'
                                : '#eab308',
                          }}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td>
                        <strong>{inc.confidence}%</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '4px' }}>
                          ({inc.verifications || 0} verifs)
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                          {inc.assignedUnit || 'Unassigned'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {inc.reportedAt || inc.reportedTimeFull}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="action-resolve-btn"
                            onClick={() => handleOpenResolutionModal(inc)}
                          >
                            Update Status
                          </button>
                          <button
                            type="button"
                            className="focus-corridor-btn"
                            onClick={() => navigate(`/app/incidents/${inc.id}`)}
                          >
                            Details
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
      </div>

      {/* Resolution & Dispatch Modal */}
      {selectedIncident && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="resolution-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dispatch & Resolution: {selectedIncident.category}</h3>
              <button type="button" className="modal-close-btn" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitResolution}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.84rem' }}>
                  <strong>Location:</strong> {selectedIncident.fullLocation || selectedIncident.location}
                  <br />
                  <strong>Description:</strong> {selectedIncident.description || 'No citizen description.'}
                </div>

                <div className="form-group">
                  <label htmlFor="res-status">Incident Resolution Status</label>
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

                <div className="form-group">
                  <label htmlFor="res-action">Official Intervention / Action Taken</label>
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

                <div className="form-group">
                  <label htmlFor="res-unit">Assigned Emergency Response Unit / Call-sign</label>
                  <input
                    id="res-unit"
                    type="text"
                    value={modalUnit}
                    onChange={(e) => setModalUnit(e.target.value)}
                    placeholder="e.g. UNIT-TP-04 or PWD-CREW-12"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="res-notes">Official Public Advisory / Resolution Notes</label>
                  <textarea
                    id="res-notes"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="e.g., Road clearance complete; tow vehicle moved off highway; all lanes reopened."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="modal-cancel-btn" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn" disabled={savingResolution}>
                  {savingResolution ? 'Saving…' : 'Confirm & Broadcast Live'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
