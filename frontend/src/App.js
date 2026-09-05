import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import SystemResources from './components/SystemResources';
import CurrentlyRunning from './components/CurrentlyRunning';
import ReadyQueue from './components/ReadyQueue';
import SchedulerDecision from './components/SchedulerDecision';
import EventLog from './components/EventLog';
import AIAgent from './components/AIAgent';
import MetricsPanel from './components/MetricsPanel';
import ComparisonModal from './components/ComparisonModal';
import AddJobModal from './components/AddJobModal';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1421 50%, #0a1128 100%)',
    color: '#e2e8f0',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto auto auto auto',
    gap: '16px',
    padding: '16px',
    maxWidth: '1800px',
    margin: '0 auto',
  },
  fullWidth: { gridColumn: '1 / -1' },
  twoThirds: { gridColumn: 'span 2' },
  oneThird: { gridColumn: 'span 1' },
};

export default function App() {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [activeScenario, setActiveScenario] = useState(1);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${WS_BASE}/ws/live`);
    ws.onopen = () => { setIsConnected(true); clearTimeout(reconnectTimer.current); };
    ws.onmessage = (e) => {
      try { setState(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connectWS, 2000);
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  const apiCall = async (path, method = 'POST', body = null) => {
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${path}`, opts);
      return await res.json();
    } catch (e) { console.error(e); }
  };

  const handleScenario = async (id) => {
    setActiveScenario(id);
    await apiCall(`/api/scenario/${id}`);
  };

  const handleReset = () => apiCall('/api/reset');

  const handlePause = async () => {
    if (isPaused) { await apiCall('/api/resume'); setIsPaused(false); }
    else { await apiCall('/api/pause'); setIsPaused(true); }
  };

  const handleGenerate = () => apiCall('/api/generate', 'POST', { count: 5 });

  const handleCompare = async () => {
    const data = await fetch(`${API_BASE}/api/comparison/${activeScenario}`).then(r => r.json());
    setComparisonData(data);
    setShowComparison(true);
  };

  const handleAddJob = async (jobData) => {
    await apiCall('/api/jobs', 'POST', jobData);
    setShowAddJob(false);
  };

  return (
    <div style={styles.app}>
      <Header
        isConnected={isConnected}
        isPaused={isPaused}
        activeScenario={activeScenario}
        onScenario={handleScenario}
        onReset={handleReset}
        onPause={handlePause}
        onGenerate={handleGenerate}
        onCompare={handleCompare}
        onAddJob={() => setShowAddJob(true)}
      />

      <div style={styles.grid}>
        {/* Row 1: Metrics */}
        <div style={styles.fullWidth}>
          <MetricsPanel metrics={state?.metrics} />
        </div>

        {/* Row 2: Resources + Running + AI */}
        <SystemResources resources={state?.resources} />
        <CurrentlyRunning job={state?.running_job} />
        <AIAgent aiStatus={state?.ai_status} />

        {/* Row 3: Decision + Queue */}
        <SchedulerDecision decision={state?.decision} />
        <div style={styles.twoThirds}>
          <ReadyQueue queue={state?.ready_queue} />
        </div>

        {/* Row 4: Event Log */}
        <div style={styles.fullWidth}>
          <EventLog events={state?.event_log} />
        </div>
      </div>

      {showComparison && (
        <ComparisonModal data={comparisonData} onClose={() => setShowComparison(false)} />
      )}
      {showAddJob && (
        <AddJobModal onSubmit={handleAddJob} onClose={() => setShowAddJob(false)} />
      )}
    </div>
  );
}
