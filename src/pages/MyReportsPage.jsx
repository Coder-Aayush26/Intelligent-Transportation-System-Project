import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircle, RefreshCw, AlertCircle, CheckCircle2, Clock, 
  MapPin, FileText, Search, ExternalLink 
} from 'lucide-react';
import { fetchMyReports } from '../api/incidents';
import { CATEGORY_STYLES, INCIDENT_CATEGORIES } from '../data/mockData';
import './MyReportsPage.css';

const SEVERITY_COLORS = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#ef4444',
  Critical: '#8b5cf6',
};

export default function MyReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Verified', 'Pending'

  async function loadReports(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await fetchMyReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load user reports:', err);
      setError(err.message || 'Unable to load your incident reports. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Status filter
      const isVerified = (item.confidence >= 70) || (item.verifications >= 2);
      if (statusFilter === 'Verified' && !isVerified) return false;
      if (statusFilter === 'Pending' && isVerified) return false;

      // Text query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const loc = (item.fullLocation || item.location || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        return loc.includes(query) || desc.includes(query) || cat.includes(query);
      }

      return true;
    });
  }, [reports, selectedCategory, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = reports.length;
    const verified = reports.filter(r => (r.confidence >= 70) || (r.verifications >= 2)).length;
    const pending = total - verified;
    const totalVerifs = reports.reduce((acc, r) => acc + (r.verifications || r.nearbyVerifications || 0), 0);
    return { total, verified, pending, totalVerifs };
  }, [reports]);

  return (
    <div className="my-reports-page">
      {/* Page Header */}
      <div className="reports-header-card">
        <div className="reports-header-text">
          <div className="reports-title-row">
            <div className="reports-icon-badge">
              <FileText size={22} color="#2563eb" />
            </div>
            <div>
              <h1 className="reports-title">My Reports</h1>
              <p className="reports-subtitle">
                Track, review, and follow community verification progress on incidents you've reported.
              </p>
            </div>
          </div>
        </div>

        <div className="reports-header-actions">
          <button 
            type="button" 
            className="reports-refresh-btn" 
            onClick={() => loadReports(true)}
            disabled={loading || refreshing}
            title="Refresh reports"
          >
            <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            type="button" 
            className="reports-new-btn" 
            onClick={() => navigate('/app/report')}
          >
            <PlusCircle size={17} />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Tiles */}
      <div className="reports-stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Reports</div>
          <div className="stat-val stat-blue">{stats.total}</div>
          <div className="stat-desc">Submitted by you</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Community Verified</div>
          <div className="stat-val stat-green">{stats.verified}</div>
          <div className="stat-desc">≥70% confidence level</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Verification</div>
          <div className="stat-val stat-orange">{stats.pending}</div>
          <div className="stat-desc">Awaiting confirmations</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Verifications Received</div>
          <div className="stat-val stat-purple">{stats.totalVerifs}</div>
          <div className="stat-desc">Community reviews & votes</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="reports-filter-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="reports-search-input"
            placeholder="Search by road, location, or keyword…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="search-clear-btn" 
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-select-group">
          <select
            className="reports-filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {INCIDENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            className="reports-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Verified">Verified (≥70% Conf.)</option>
            <option value="Pending">Pending Review</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="reports-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => loadReports()} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="reports-loading-container">
          <div className="spinner" />
          <p>Loading your reported incidents…</p>
        </div>
      ) : filteredReports.length === 0 ? (
        /* Empty State */
        <div className="reports-empty-card">
          <div className="empty-icon-wrap">
            <FileText size={40} color="#94a3b8" />
          </div>
          <h3>{reports.length === 0 ? 'No incidents reported yet' : 'No matching reports found'}</h3>
          <p>
            {reports.length === 0
              ? 'When you report traffic disruptions, accidents, road hazards, or waterlogging, they will be tracked and displayed here.'
              : 'Try clearing your search query or selecting a different category filter.'}
          </p>
          {reports.length === 0 ? (
            <button
              type="button"
              className="reports-new-btn"
              onClick={() => navigate('/app/report')}
            >
              <PlusCircle size={17} />
              <span>Report Your First Incident</span>
            </button>
          ) : (
            <button
              type="button"
              className="reports-refresh-btn"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                setStatusFilter('All');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* Reports Grid */
        <div className="reports-cards-grid">
          {filteredReports.map((report) => {
            const catStyle = CATEGORY_STYLES[report.category] || CATEGORY_STYLES.Other;
            const severityColor = SEVERITY_COLORS[report.severity] || '#64748b';
            const isVerified = (report.confidence >= 70) || (report.verifications >= 2);

            return (
              <div 
                key={report.id} 
                className="report-item-card"
                onClick={() => navigate(`/app/incidents/${report.id}`)}
              >
                {/* Card Top Header */}
                <div className="report-card-top">
                  <div className="report-cat-wrap">
                    <span 
                      className="report-cat-badge" 
                      style={{ 
                        backgroundColor: `${catStyle.color}15`, 
                        color: catStyle.color,
                        borderColor: `${catStyle.color}35` 
                      }}
                    >
                      <span className="cat-emoji">{catStyle.icon}</span>
                      <span className="cat-name">{report.category}</span>
                    </span>
                    <span 
                      className="report-sev-badge" 
                      style={{ 
                        backgroundColor: `${severityColor}15`, 
                        color: severityColor,
                        borderColor: `${severityColor}35` 
                      }}
                    >
                      {report.severity}
                    </span>
                  </div>

                  <div className="report-time" title={report.reportedTimeFull || report.reportedAt}>
                    <Clock size={13} />
                    <span>{report.reportedAt || 'Recently'}</span>
                  </div>
                </div>

                {/* Location */}
                <div className="report-location-row">
                  <MapPin size={16} className="loc-icon" />
                  <span className="loc-text">{report.fullLocation || report.location || 'Reported Location'}</span>
                </div>

                {/* Description */}
                <p className="report-description">
                  {report.description || 'No additional details provided.'}
                </p>

                {/* Media Thumbnails if attached */}
                {Array.isArray(report.mediaUrls) && report.mediaUrls.length > 0 && (
                  <div className="report-media-strip">
                    {report.mediaUrls.map((url, idx) => (
                      <img 
                        key={idx} 
                        src={url} 
                        alt={`Attachment ${idx + 1}`} 
                        className="report-thumb"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ))}
                    <span className="media-count-badge">
                      📷 {report.mediaUrls.length} {report.mediaUrls.length === 1 ? 'photo' : 'photos'}
                    </span>
                  </div>
                )}

                {/* Verification & Confidence Bar */}
                <div className="report-confidence-block">
                  <div className="conf-label-row">
                    <span className="conf-title">Community Trust Score</span>
                    <span className="conf-percentage">{report.confidence}%</span>
                  </div>
                  <div className="conf-bar-track">
                    <div 
                      className="conf-bar-fill" 
                      style={{ 
                        width: `${Math.max(5, Math.min(100, report.confidence))}%`,
                        backgroundColor: report.confidence >= 70 ? '#10b981' : report.confidence >= 40 ? '#f59e0b' : '#ef4444'
                      }} 
                    />
                  </div>
                </div>

                {/* Card Footer */}
                <div className="report-card-footer">
                  <div className="verification-status-pill">
                    {isVerified ? (
                      <span className="verified-pill">
                        <CheckCircle2 size={14} />
                        <span>Verified ({report.verifications || report.nearbyVerifications || 1} votes)</span>
                      </span>
                    ) : (
                      <span className="pending-pill">
                        <Clock size={14} />
                        <span>In Community Review</span>
                      </span>
                    )}
                  </div>

                  <button 
                    type="button" 
                    className="view-details-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/incidents/${report.id}`);
                    }}
                  >
                    <span>View Map & Details</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
