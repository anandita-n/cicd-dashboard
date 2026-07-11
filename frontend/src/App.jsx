import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Server,
  Layers
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [recentBuilds, setRecentBuilds] = useState([]);
  const [failureRateData, setFailureRateData] = useState([]);
  const [durationTrendData, setDurationTrendData] = useState([]);
  const [topFailingJobs, setTopFailingJobs] = useState([]);
  
  // Selection States
  const [selectedJob, setSelectedJob] = useState('snap-link');
  const [days, setDays] = useState(7);
  const [durationDays, setDurationDays] = useState(30);
  
  // App States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch data in parallel
      const [recentRes, failureRes, topRes, durationRes] = await Promise.all([
        fetch(`${API_BASE_URL}/builds/recent?limit=15`),
        fetch(`${API_BASE_URL}/stats/failure-rate?days=${days}`),
        fetch(`${API_BASE_URL}/stats/top-failing-jobs`),
        fetch(`${API_BASE_URL}/stats/duration-trend?job=${selectedJob}&days=${durationDays}`)
      ]);

      if (!recentRes.ok || !failureRes.ok || !topRes.ok || !durationRes.ok) {
        throw new Error('Failed to fetch data from backend. Make sure FastAPI server is running.');
      }

      const recentData = await recentRes.json();
      const failureData = await failureRes.json();
      const topData = await topRes.json();
      const durationData = await durationRes.json();

      setRecentBuilds(recentData);
      setFailureRateData(failureData);
      setTopFailingJobs(topData);
      setDurationTrendData(durationData);
      
      // If we don't have selectedJob in database, default to the first available top job
      if (topData.length > 0 && !topData.some(j => j.job_name === selectedJob)) {
        setSelectedJob(topData[0].job_name);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days, selectedJob, durationDays]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper: Format duration (seconds) -> Mm Ss
  const formatDuration = (secs) => {
    if (secs === undefined || secs === null) return '0s';
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.round(secs % 60);
    return `${mins}m ${remainingSecs}s`;
  };

  // Helper: Format ISO timestamp to clean format
  const formatTimestamp = (isoStr) => {
    if (!isoStr) return 'N/A';
    const date = new Date(isoStr);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Compute stats for metrics cards based on loaded data
  const totalBuildsCollected = recentBuilds.length;
  const successCount = recentBuilds.filter(b => b.status === 'SUCCESS').length;
  const failureCount = recentBuilds.filter(b => b.status === 'FAILURE').length;
  const overallSuccessRate = totalBuildsCollected > 0 
    ? ((successCount / totalBuildsCollected) * 100).toFixed(1) 
    : '0';
  
  // Calculate average duration in recent builds
  const avgDurationRecent = recentBuilds.length > 0
    ? recentBuilds.reduce((sum, b) => sum + b.duration_seconds, 0) / recentBuilds.length
    : 0;

  // Custom tooltips for charting
  const customPercentFormatter = (value) => `${(value * 100).toFixed(1)}%`;

  if (loading && !refreshing) {
    return (
      <div className="state-container">
        <div>Loading dashboard metrics...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header>
        <div>
          <h1>CI/CD Pipeline Observability</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Jenkins build historical trends and failure analytics
          </p>
        </div>
        <div className="controls">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            <RefreshCw className={refreshing ? 'spin-animation' : ''} size={16} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="state-container" style={{ height: 'auto', marginBottom: '2.5rem', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--failure-color)', borderRadius: '0.5rem' }}>
          <div className="error-text">
            <strong>Error:</strong> {error}
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              Ensure your backend FastAPI server is running on <code style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>http://localhost:8000</code>.
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-label">
            <Activity size={16} style={{ color: 'var(--accent-color)' }} />
            Recent Builds Ingested
          </div>
          <div className="metric-value">{recentBuilds.length}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <CheckCircle size={16} style={{ color: 'var(--success-color)' }} />
            Recent Success Rate
          </div>
          <div className="metric-value">{overallSuccessRate}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <Clock size={16} style={{ color: 'var(--accent-color)' }} />
            Avg Build Duration (Recent)
          </div>
          <div className="metric-value">{formatDuration(avgDurationRecent)}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <Server size={16} style={{ color: 'var(--accent-color)' }} />
            Tracked Jobs
          </div>
          <div className="metric-value">{topFailingJobs.length}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Line Chart: Failure Rate over time */}
        <div className="chart-card">
          <div className="chart-title">
            <span>Failure Rate Over Time</span>
            <div>
              <label htmlFor="failure-days-select" style={{ marginRight: '0.5rem' }}>Window:</label>
              <select
                id="failure-days-select"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>
          </div>
          <div className="chart-container">
            {failureRateData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No failure data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={failureRateData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Failure Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="failure_rate"
                    stroke="var(--accent-color)"
                    strokeWidth={2.5}
                    dot={{ stroke: 'var(--accent-color)', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Build Duration Trend */}
        <div className="chart-card">
          <div className="chart-title">
            <span>Average Build Duration</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
              >
                {topFailingJobs.map(job => (
                  <option key={job.job_name} value={job.job_name}>{job.job_name}</option>
                ))}
                {topFailingJobs.length === 0 && <option value="snap-link">snap-link</option>}
              </select>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>
          <div className="chart-container">
            {durationTrendData.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No duration data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${val}s`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                    formatter={(value) => [`${value} seconds`, 'Avg Duration']}
                  />
                  <Bar
                    dataKey="average_duration"
                    fill="var(--accent-color)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid (Lists & Tables) */}
      <div className="bottom-grid">
        {/* Top Failing Jobs */}
        <div className="section-card">
          <div className="section-title">
            <AlertTriangle size={18} style={{ color: 'var(--failure-color)' }} />
            Failure Ranking by Job
          </div>
          <div className="ranking-list">
            {topFailingJobs.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                No job metrics compiled yet.
              </div>
            ) : (
              topFailingJobs.map(job => (
                <div className="ranking-item" key={job.job_name}>
                  <div>
                    <span className="ranking-name">{job.job_name}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {job.total_builds} total builds
                    </div>
                  </div>
                  <div className="ranking-stats">
                    <span className="ranking-count">{job.failed_builds} failed</span>
                    <div className="ranking-rate">{(job.failure_rate * 100).toFixed(1)}% failure rate</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Builds Table */}
        <div className="section-card">
          <div className="section-title">
            <Layers size={18} style={{ color: 'var(--accent-color)' }} />
            Recent Build History
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Job Name</th>
                  <th>Build #</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Started At</th>
                </tr>
              </thead>
              <tbody>
                {recentBuilds.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      No builds found in the database.
                    </td>
                  </tr>
                ) : (
                  recentBuilds.map((build) => (
                    <tr key={build.id}>
                      <td style={{ fontWeight: '500' }}>{build.job_name}</td>
                      <td>#{build.build_number}</td>
                      <td>
                        <span className={`status-pill ${build.status.toLowerCase()}`}>
                          {build.status}
                        </span>
                      </td>
                      <td>{formatDuration(build.duration_seconds)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatTimestamp(build.started_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Dynamic CSS animations */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
