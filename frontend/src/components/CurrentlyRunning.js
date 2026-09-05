import React, { useState, useEffect } from 'react';

const PRIORITY_COLORS = {
  Critical: { bg: '#ff000022', border: '#ef4444', text: '#ef4444' },
  High: { bg: '#f9731622', border: '#f97316', text: '#f97316' },
  Medium: { bg: '#3b82f622', border: '#3b82f6', text: '#3b82f6' },
  Low: { bg: '#6b728022', border: '#6b7280', text: '#6b7280' },
};

const card = {
  background: '#161b27',
  borderRadius: '12px',
  border: '1px solid #1e2840',
  padding: '16px',
  height: '100%',
};

const label = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' };

export default function CurrentlyRunning({ job }) {
  const [deadlineLeft, setDeadlineLeft] = useState(0);

  useEffect(() => {
    if (!job) return;
    const interval = setInterval(() => {
      const left = job.deadline - Date.now() / 1000;
      setDeadlineLeft(Math.max(0, left));
    }, 100);
    return () => clearInterval(interval);
  }, [job]);

  if (!job) {
    return (
      <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <div style={label}>▶ Currently Running</div>
        <div style={{ fontSize: '32px' }}>💤</div>
        <div style={{ color: '#64748b', fontSize: '14px' }}>No jobs running</div>
      </div>
    );
  }

  const pc = PRIORITY_COLORS[job.priority] || PRIORITY_COLORS.Medium;
  const progress = job.progress || 0;
  const deadlineWarning = deadlineLeft < 10;
  const isStarved = job.score >= 999;

  return (
    <div style={{ ...card, borderColor: pc.border + '44', boxShadow: `0 0 20px ${pc.border}11` }}>
      <div style={label}>▶ Currently Running</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', animation: 'blink 1s infinite' }} />
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.name}
        </div>
        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}44` }}>
          {job.priority}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: '#0d1117', borderRadius: '8px', padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>DEADLINE</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: deadlineWarning ? '#ef4444' : '#00d4ff', fontFamily: 'monospace' }}>
            {deadlineLeft.toFixed(1)}s
          </div>
        </div>
        <div style={{ background: '#0d1117', borderRadius: '8px', padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>SCORE</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#7b2ff7', fontFamily: 'monospace' }}>
            {isStarved ? '∞' : job.score?.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#00d4ff' }}>🖥 {job.cpu_units} CPU</span>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#7b2ff7' }}>🔲 {job.gpu_units} GPU</span>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#00ff88' }}>💾 {job.ram_units}GB</span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
          <span>Progress</span>
          <span>{(progress * 100).toFixed(0)}%</span>
        </div>
        <div style={{ height: '8px', background: '#0d1117', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg, ${pc.text}88, ${pc.text})`, borderRadius: '4px', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {isStarved && <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b', background: '#f59e0b11', padding: '4px 8px', borderRadius: '4px' }}>🛡️ Starvation rescue active</div>}
      {deadlineWarning && <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444', background: '#ef444411', padding: '4px 8px', borderRadius: '4px' }}>⚠️ Deadline critical!</div>}

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
