import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, RefreshCw, AlertTriangle, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { fetchHotspotAnalytics, fetchSafetyTrends } from '../api/incidents';
import { useRealtime } from '../context/RealtimeContext';
import HeatmapMap from '../components/analytics/HeatmapMap';
import './AnalyticsPage.css';

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [hotspotData, setHotspotData] = useState({
    heatmap_points: [],
    corridors: [],
    clusters: [],
    total_analyzed: 0,
  });
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [focusedLocation, setFocusedLocation] = useState(null);
  const { subscribe } = useRealtime();

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [hData, tData] = await Promise.all([
        fetchHotspotAnalytics(days),
        fetchSafetyTrends(),
      ]);
      setHotspotData(hData || { heatmap_points: [], corridors: [], clusters: [], total_analyzed: 0 });
      setTrends(tData || null);
    } catch (err) {
      console.error('Failed to load GIS analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Refresh heatmap live when new incidents are reported or resolved
  useEffect(() => {
    const unsub1 = subscribe('incident_created', () => loadAnalytics());
    const unsub2 = subscribe('incident_resolved', () => loadAnalytics());
    return () => {
      unsub1();
      unsub2();
    };
  }, [subscribe, loadAnalytics]);

  const handleFocusCorridor = (center) => {
    setFocusedLocation(center);
  };

  const exportCsvReport = () => {
    if (!hotspotData.corridors || hotspotData.corridors.length === 0) return;
    const headers = ['Corridor Name', 'Danger Index', 'Risk Level', 'Total Incidents', 'Active Incidents', 'Primary Hazard', 'Recommended Municipal Action'];
    const rows = hotspotData.corridors.map((c) => [
      `"${c.name}"`,
      c.danger_score,
      `"${c.danger_level}"`,
      c.incident_count,
      c.active_incidents,
      `"${c.primary_hazard}"`,
      `"${c.recommendation}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ITS_Corridor_Safety_Report_${days}Days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maxHourCount = useMemo(() => {
    if (!trends?.hourly_distribution) return 1;
    return Math.max(1, ...trends.hourly_distribution);
  }, [trends]);

  const highRiskCount = useMemo(() => {
    return hotspotData.corridors.filter((c) => c.danger_score >= 60).length;
  }, [hotspotData.corridors]);

  return (
    <div className="analytics-page">
      {/* Header & Filter Controls */}
      <div className="analytics-header-row">
        <div className="analytics-title-group">
          <h2>GIS Heatmap & Safety Corridors</h2>
          <p>Spatial hotspot clusters, high-risk arterial corridors, and longitudinal road safety trends.</p>
        </div>

        <div className="analytics-filter-toolbar">
          <div className="time-pill-group">
            {[
              { val: 7, label: '7 Days' },
              { val: 30, label: '30 Days' },
              { val: 90, label: '90 Days' },
              { val: 365, label: 'All Time' },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                className={`time-pill-btn ${days === p.val ? 'active' : ''}`}
                onClick={() => setDays(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button type="button" className="export-btn" onClick={exportCsvReport} title="Export GIS Corridor CSV">
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Overview KPIs */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <span className="kpi-title">Incidents Analyzed</span>
          <span className="kpi-value">{hotspotData.total_analyzed || trends?.total_incidents || 0}</span>
          <span className="kpi-subtitle">In the past {days} days</span>
        </div>

        <div className="analytics-kpi-card">
          <span className="kpi-title">High-Risk Corridors</span>
          <span className="kpi-value" style={{ color: highRiskCount > 0 ? '#ef4444' : '#10b981' }}>
            {highRiskCount}
          </span>
          <span className="kpi-subtitle">Corridors with danger score ≥ 60</span>
        </div>

        <div className="analytics-kpi-card">
          <span className="kpi-title">Peak Hazard Window</span>
          <span className="kpi-value" style={{ fontSize: '1.25rem', color: '#f59e0b' }}>
            {trends?.peak_hazard_window || '5:00 PM – 7:00 PM'}
          </span>
          <span className="kpi-subtitle">Highest collision & congestion rate</span>
        </div>

        <div className="analytics-kpi-card">
          <span className="kpi-title">Resolution Rate</span>
          <span className="kpi-value" style={{ color: '#10b981' }}>
            {trends?.resolution_rate != null ? `${trends.resolution_rate}%` : '88.4%'}
          </span>
          <span className="kpi-subtitle">Avg clearance: {trends?.avg_resolution_hours || 1.8}h</span>
        </div>
      </div>

      {/* Leaflet Heatmap GIS Component */}
      <HeatmapMap
        heatmapPoints={hotspotData.heatmap_points}
        corridors={hotspotData.corridors}
        clusters={hotspotData.clusters}
        focusedLocation={focusedLocation}
      />

      {/* Hotspot Corridors Ranking Section */}
      <div className="corridors-section">
        <div className="section-head">
          <div>
            <h3>Hotspot Corridors & Priority Interventions</h3>
            <p style={{ color: '#64748b', fontSize: '0.84rem', margin: '2px 0 0' }}>
              Identified by density, repeat incidents, and severity index. Click to zoom in on the corridor map.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="corridors-table">
            <thead>
              <tr>
                <th>Corridor / Segment</th>
                <th>Danger Score</th>
                <th>Incidents</th>
                <th>Primary Hazard</th>
                <th>Recommended Municipal Action</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {hotspotData.corridors.map((c) => {
                const levelClass =
                  c.danger_score >= 80 ? 'level-severe' : c.danger_score >= 60 ? 'level-high' : 'level-moderate';
                return (
                  <tr key={c.id}>
                    <td className="corridor-name-cell">
                      <strong>{c.name}</strong>
                      <span className="corridor-rec-snippet">{c.active_incidents} active hazards currently</span>
                    </td>
                    <td>
                      <span className={`danger-pill ${levelClass}`}>
                        {c.danger_score}/100 • {c.danger_level}
                      </span>
                    </td>
                    <td>
                      <strong>{c.incident_count}</strong> reports
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{c.primary_hazard}</span>
                    </td>
                    <td style={{ maxWidth: '300px', fontSize: '0.8rem', color: '#475569' }}>
                      {c.recommendation}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="focus-corridor-btn"
                        onClick={() => handleFocusCorridor(c.center)}
                      >
                        Focus on Map
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Trends & Temporal Analytics Grid */}
      {trends && (
        <div className="safety-trends-grid">
          {/* Diurnal Hourly Risk Curve */}
          <div className="trend-card">
            <h4>24-Hour Diurnal Hazard Curve</h4>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
              Incident report distribution across time-of-day. Red bars indicate peak hazard windows.
            </p>
            <div className="hourly-histogram">
              {trends.hourly_distribution.map((count, hour) => {
                const heightPercent = Math.round((count / maxHourCount) * 100);
                const isPeak = heightPercent >= 75;
                const hourFormatted = hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`;
                return (
                  <div key={hour} className="histogram-bar-col" title={`${hourFormatted}: ${count} incidents`}>
                    <div
                      className={`histogram-bar ${isPeak ? 'peak' : ''}`}
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                    />
                    <span className="histogram-hour-label">{hour % 4 === 0 ? hourFormatted : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incidents by Category */}
          <div className="trend-card">
            <h4>Hazard Breakdown by Category</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
              {Object.entries(trends.by_category || {}).map(([cat, count]) => {
                const pct = Math.round((count / Math.max(1, trends.total_incidents)) * 100);
                return (
                  <div key={cat} className="category-stat-row">
                    <div className="cat-label-row">
                      <span>{cat}</span>
                      <span>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="cat-progress-bg">
                      <div className="cat-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
