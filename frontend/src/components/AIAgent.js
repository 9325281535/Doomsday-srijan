import React from 'react';

const TREND_CONFIG = {
  improving: { color: '#00ff88', icon: '↑', label: 'Improving' },
  declining: { color: '#ef4444', icon: '↓', label: 'Declining' },
  stable: { color: '#f59e0b', icon: '→', label: 'Stable' },
};

const WeightBar = ({ label, value, color }) => (
  <div style={{ marginBottom: '8px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color, fontWeight: '700', fontFamily: 'monospace' }}>{(value * 100).toFixed(1)}%</span>
    </div>
    <div style={{ height: '5px', background: '#0d1117', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value * 100}%`, background: color, borderRadius: '3px', transition: 'width 0.8s ease' }} />
    </div>
  </div>
);

export default function AIAgent({ aiStatus }) {
  const ai = aiStatus || { weights: { w1: 0.35, w2: 0.25, w3: 0.20, w4: 0.20 }, is_retraining: false, retrain_count: 0, performance_trend: 'stable' };
  const w = ai.weights || {};
  const trend = TREND_CONFIG[ai.performance_trend] || TREND_CONFIG.stable;

  return (
    <div style={{ background: '#161b27', borderRadius: '12px', border: `1px solid ${ai.is_retraining ? '#7b2ff7' : '#1e2840'}`, padding: '16px', transition: 'border-color 0.5s', boxShadow: ai.is_retraining ? '0 0 20px #7b2ff722' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>🤖 AI Agent</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ai.is_retraining ? '#7b2ff7' : '#00ff88', boxShadow: `0 0 8px ${ai.is_retraining ? '#7b2ff7' : '#00ff88'}`, animation: ai.is_retraining ? 'spin 1s linear infinite' : 'none' }} />
          <span style={{ fontSize: '11px', color: ai.is_retraining ? '#7b2ff7' : '#00ff88', fontWeight: '600' }}>
            {ai.is_retraining ? 'Retraining...' : 'Active'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>RETRAINS</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#7b2ff7' }}>{ai.retrain_count}</div>
        </div>
        <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>TREND</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: trend.color }}>{trend.icon} {trend.label}</div>
        </div>
      </div>

      <div style={{ marginBottom: '4px', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-tuned Weights</div>
      <WeightBar label="W1 — Deadline Urgency" value={w.w1 || 0} color="#ef4444" />
      <WeightBar label="W2 — Aging Factor" value={w.w2 || 0} color="#00ff88" />
      <WeightBar label="W3 — Resource Efficiency" value={w.w3 || 0} color="#7b2ff7" />
      <WeightBar label="W4 — Base Priority" value={w.w4 || 0} color="#3b82f6" />

      {ai.is_retraining && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#7b2ff7', background: '#7b2ff711', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
          ⚙️ Gradient optimization running...
        </div>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
