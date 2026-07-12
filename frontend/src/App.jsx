import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  Activity,
  Clock,
  CheckCircle,
  Server
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [recentBuilds, setRecentBuilds] = useState([]);
  const [failureRateData, setFailureRateData] = useState([]);
  const [durationTrendData, setDurationTrendData] = useState([]);
  const [topFailingJobs, setTopFailingJobs] = useState([]);
  
  // Selection & UI States
  const [jobFilter, setJobFilter] = useState('all'); // 'all' | 'snap-link' | 'smartspend-pipeline'
  const [activeTab, setActiveTab] = useState('failure-rate'); // 'failure-rate' | 'duration'
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
      
      const recentUrl = jobFilter !== 'all' 
        ? `${API_BASE_URL}/builds/recent?limit=60&job=${jobFilter}` 
        : `${API_BASE_URL}/builds/recent?limit=60`;
        
      const failureUrl = jobFilter !== 'all'
        ? `${API_BASE_URL}/stats/failure-rate?days=${days}&job=${jobFilter}`
        : `${API_BASE_URL}/stats/failure-rate?days=${days}`;

      const durationUrl = `${API_BASE_URL}/stats/duration-trend?job=${selectedJob}&days=${durationDays}`;
      const topUrl = `${API_BASE_URL}/stats/top-failing-jobs`;

      const [recentRes, failureRes, topRes, durationRes] = await Promise.all([
        fetch(recentUrl),
        fetch(failureUrl),
        fetch(topUrl),
        fetch(durationUrl)
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
  }, [days, selectedJob, durationDays, jobFilter]);

  // Sync selectedJob for Duration chart when jobFilter changes
  useEffect(() => {
    if (jobFilter !== 'all') {
      setSelectedJob(jobFilter);
    }
  }, [jobFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper: Format duration (seconds) -> Mm Ss
  const formatDuration = (secs) => {
    if (secs === undefined || secs === null || isNaN(secs)) return '0s';
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

  // Calculate Metrics
  const totalBuilds = recentBuilds.length;
  const successCount = recentBuilds.filter(b => b.status === 'SUCCESS').length;
  const failureCount = recentBuilds.filter(b => b.status === 'FAILURE').length;
  const totalCalculated = successCount + failureCount;
  const successRate = totalCalculated > 0 
    ? ((successCount / totalCalculated) * 100).toFixed(1) 
    : '100.0';
  
  const avgDuration = recentBuilds.length > 0
    ? recentBuilds.reduce((sum, b) => sum + b.duration_seconds, 0) / recentBuilds.length
    : 0;

  // Get Latest Build Status
  const latestBuild = recentBuilds[0];
  const latestStatus = latestBuild ? latestBuild.status : 'N/A';

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
          <h1>CI/CD Pipeline Monitor</h1>
          <p>Real-time Jenkins historical build trends and health analytics</p>
        </div>
        
        {/* Global Job Selector */}
        <div className="controls">
          <label htmlFor="global-job-filter">Filter Job:</label>
          <select
            id="global-job-filter"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
          >
            <option value="all">All Jobs</option>
            <option value="snap-link">snap-link</option>
            <option value="smartspend-pipeline">smartspend-pipeline</option>
          </select>
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="state-container" style={{ height: 'auto', marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'var(--failure-bg)', border: '1px solid var(--failure-border)', borderRadius: '0.5rem' }}>
          <div className="error-text">
            <strong>Connection Error:</strong> {error}
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Verify the FastAPI backend is running at <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>http://localhost:8000</code>.
            </div>
          </div>
        </div>
      )}

      {/* Aggregate View Info Banner */}
      {jobFilter === 'all' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          backgroundColor: 'var(--accent-bg)', 
          color: 'var(--accent-color)', 
          padding: '0.6rem 1.25rem', 
          borderRadius: '0.375rem', 
          fontSize: '0.825rem', 
          fontWeight: 500, 
          marginBottom: '1.5rem',
          border: '1px solid var(--accent-border)'
        }}>
          <span>Combined view showing aggregated metrics across 2 tracked jobs.</span>
        </div>
      )}

      {/* Metrics Row (5 Cards) */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="metric-card accent">
          <div className="metric-label">
            <Server size={14} style={{ color: 'var(--accent-color)' }} />
            Tracked Jobs
          </div>
          <div className="metric-value">{topFailingJobs.length}</div>
        </div>

        <div className="metric-card accent">
          <div className="metric-label">
            <Activity size={14} style={{ color: 'var(--accent-color)' }} />
            Total Builds
          </div>
          <div className="metric-value">{totalBuilds}</div>
        </div>

        <div className="metric-card success">
          <div className="metric-label">
            <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
            Success Rate
          </div>
          <div className="metric-value">{successRate}%</div>
        </div>

        <div className="metric-card accent">
          <div className="metric-label">
            <Clock size={14} style={{ color: 'var(--accent-color)' }} />
            Avg Duration
          </div>
          <div className="metric-value">{formatDuration(avgDuration)}</div>
        </div>

        <div className={`metric-card ${
          latestStatus === 'SUCCESS' ? 'success' : 
          latestStatus === 'FAILURE' ? 'failure' : 
          latestStatus === 'BUILDING' ? 'building' : 'aborted'
        }`}>
          <div className="metric-label">
            <div className={`status-dot ${latestStatus.toLowerCase()}`} />
            Latest Build
          </div>
          <div className="metric-value" style={{ 
            color: latestStatus === 'SUCCESS' ? '#047857' : 
                   latestStatus === 'FAILURE' ? '#b91c1c' : 
                   latestStatus === 'BUILDING' ? '#b45309' : 'var(--text-primary)'
          }}>
            {latestStatus}
          </div>
        </div>
      </div>

      {/* Main Content Layout (Full Width Chart) */}
      <div className="main-layout" style={{ gridTemplateColumns: '1fr' }}>
        {/* Analytics Chart Card */}
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-tabs">
              <button 
                className={`chart-tab ${activeTab === 'failure-rate' ? 'active' : ''}`}
                onClick={() => setActiveTab('failure-rate')}
              >
                Failure Rate
              </button>
              <button 
                className={`chart-tab ${activeTab === 'duration' ? 'active' : ''}`}
                onClick={() => setActiveTab('duration')}
              >
                Avg Duration
              </button>
            </div>
            
            {/* Context-aware selectors */}
            <div>
              {activeTab === 'failure-rate' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="days-select">Window:</label>
                  <select
                    id="days-select"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="job-select">Job:</label>
                  <select
                    id="job-select"
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    disabled={jobFilter !== 'all'}
                  >
                    {topFailingJobs.map(job => (
                      <option key={job.job_name} value={job.job_name}>{job.job_name}</option>
                    ))}
                    {topFailingJobs.length === 0 && <option value="snap-link">snap-link</option>}
                    {topFailingJobs.length === 0 && <option value="smartspend-pipeline">smartspend-pipeline</option>}
                  </select>

                  <label htmlFor="duration-select" style={{ marginLeft: '0.5rem' }}>Window:</label>
                  <select
                    id="duration-select"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                  >
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="chart-container">
            {activeTab === 'failure-rate' ? (
              failureRateData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  No failure data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={failureRateData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <defs>
                      <linearGradient id="failureRateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '0.375rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontFamily: 'var(--font-family)' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                      formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Failure Rate']}
                    />
                    <Area
                      type="monotone"
                      dataKey="failure_rate"
                      stroke="var(--accent-color)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#failureRateGrad)"
                      dot={{ fill: '#ffffff', stroke: 'var(--accent-color)', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            ) : (
              durationTrendData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  No duration data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${val}s`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '0.375rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontFamily: 'var(--font-family)' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                      formatter={(value) => [`${value}s`, 'Avg Duration']}
                    />
                    <Bar
                      dataKey="average_duration"
                      fill="var(--accent-color)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Job Ranking + Recent Build History */}
      <div className="bottom-grid" style={{ marginBottom: '2rem' }}>
        {/* Failure Ranking by Job */}
        <div className="section-card">
          <div className="section-title">
            <span>Failure Ranking by Job</span>
          </div>
          <div className="ranking-list" style={{ overflowY: 'auto', flexGrow: 1 }}>
            {topFailingJobs.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                No job metrics compiled yet.
              </div>
            ) : (
              topFailingJobs.map(job => (
                <div 
                  className="ranking-item" 
                  key={job.job_name} 
                  onClick={() => setJobFilter(job.job_name)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '0.75rem', 
                    borderRadius: '0.375rem', 
                    backgroundColor: '#ffffff', 
                    border: jobFilter === job.job_name ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)', 
                    marginBottom: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: jobFilter === job.job_name ? '0 4px 6px rgba(46, 76, 140, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div>
                    <span className="ranking-name" style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.875rem' }}>{job.job_name}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {job.total_builds} total builds
                    </div>
                  </div>
                  <div className="ranking-stats" style={{ textAlign: 'right' }}>
                    <span className="ranking-count" style={{ fontWeight: '700', color: 'var(--failure-color)', fontSize: '0.85rem' }}>{job.failed_builds} failed</span>
                    <div className="ranking-rate" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{(job.failure_rate * 100).toFixed(1)}% rate</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Build History Table */}
        <div className="section-card">
          <div className="section-title">
            <span>Recent Build History</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
              Showing last {recentBuilds.length} runs
            </span>
          </div>
          <div className="table-wrapper">
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
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No builds found in the database.
                    </td>
                  </tr>
                ) : (
                  recentBuilds.map((build) => (
                    <tr key={build.id}>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{build.job_name}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>#{build.build_number}</td>
                      <td>
                        <span className={`status-pill ${build.status.toLowerCase()}`}>
                          <span className={`status-dot ${build.status.toLowerCase()}`} />
                          {build.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDuration(build.duration_seconds)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
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
    </div>
  );
}

export default App;
