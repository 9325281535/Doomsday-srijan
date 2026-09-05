import React from 'react';

const s = {
  header: {
    background: 'linear-gradient(90deg, #0d1117 0%, #0d1421 100%)',
    borderBottom: '1px solid #1e2840',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(10px)',
  },
  logo: {
    fontSize: '22px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px',
    marginRight: '8px',
    whiteSpace: 'nowrap',
  },
  subtitle: { fontSize: '11px', color: '#64748b', marginLeft: '-8px', whiteSpace: 'nowrap' },
  dot: (connected) => ({
    width: '8px', height: '8px', borderRadius: '50%',
    background: connected ? '#00ff88' : '#ef4444',
    boxShadow: connected ? '0 0 8px #00ff88' : '0 0 8px #ef4444',
    display: 'inline-block', marginRight: '6px',
    animation: connected ? 'pulse 2s infinite' : 'none',
  }),
  status: (connected) => ({
    fontSize: '12px', color: connected ? '#00ff88' : '#ef4444',
    display: 'flex', alignItems: 'center', marginRight: '8px',
  }),
  scenarioGroup: { display: 'flex', gap: '6px', alignItems: 'center' },
  scenarioLabel: { fontSize: '11px', color: '#64748b', marginRight: '4px' },
  scenarioBtn: (active) => ({
    padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '600', transition: 'all 0.2s',
    background: active ? 'linear-gradient(135deg, #00d4ff22, #7b2ff722)' : '#1e2840',
    color: active ? '#00d4ff' : '#94a3b8',
    borderWidth: '1px', borderStyle: 'solid',
    borderColor: active ? '#00d4ff55' : 'transparent',
  }),
  btn: (color = '#1e2840', textColor = '#94a3b8') => ({
    padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '600', background: color, color: textColor,
    transition: 'all 0.2s', whiteSpace: 'nowrap',
  }),
  spacer: { flex: 1 },
};

const SCENARIO_LABELS = { 1: '⚡ Urgent', 2: '🐢 Starvation', 3: '🖥️ GPU', 4: '⚔️ Battle' };

export default function Header({ isConnected, isPaused, activeScenario, onScenario, onReset, onPause, onGenerate, onCompare, onAddJob }) {
  return (
    <header style={s.header}>
      <div>
        <div style={s.logo}>⚡ NexScheduler AI</div>
        <div style={s.subtitle}>Smart Job Scheduling System</div>
      </div>

      <div style={s.status(isConnected)}>
        <span style={s.dot(isConnected)} />
        {isConnected ? 'Live' : 'Connecting...'}
      </div>

      <div style={s.scenarioGroup}>
        <span style={s.scenarioLabel}>DEMO:</span>
        {[1, 2, 3, 4].map(id => (
          <button key={id} style={s.scenarioBtn(activeScenario === id)} onClick={() => onScenario(id)}>
            {SCENARIO_LABELS[id]}
          </button>
        ))}
      </div>

      <div style={s.spacer} />

      <button style={s.btn('#1e3a4a', '#00d4ff')} onClick={onAddJob}>+ Add Job</button>
      <button style={s.btn('#1e2840', '#94a3b8')} onClick={onGenerate}>🎲 Generate</button>
      <button style={s.btn('#2a1a4a', '#a78bfa')} onClick={onCompare}>📊 Compare</button>
      <button style={s.btn(isPaused ? '#1a3a1a' : '#3a1a1a', isPaused ? '#00ff88' : '#f87171')} onClick={onPause}>
        {isPaused ? '▶ Resume' : '⏸ Pause'}
      </button>
      <button style={s.btn('#1e2840', '#64748b')} onClick={onReset}>↺ Reset</button>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </header>
  );
}
