import React from 'react';

const card = {
  background: '#161b27',
  borderRadius: '12px',
  border: '1px solid #1e2840',
  padding: '16px',
};

const label = { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' };

function ResourceBar({ label: name, used, total, unit = '', color }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const barColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : color;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>{name}</span>
        <span style={{ fontSize: '13px', color: barColor, fontWeight: '700' }}>
          {used}{unit} / {total}{unit} <span style={{ color: '#64748b', fontSize: '11px' }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: '8px', background: '#0d1117', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '4px',
          background: `linear-gradient(90deg, ${barColor}88, ${barColor})`,
          transition: 'width 0.5s ease',
          boxShadow: `0 0 8px ${barColor}44`,
        }} />
      </div>
    </div>
  );
}

export default function SystemResources({ resources }) {
  const r = resources || { total_cpu: 8, total_gpu: 2, total_ram: 32, used_cpu: 0, used_gpu: 0, used_ram: 0 };
  return (
    <div style={card}>
      <div style={label}>⚙️ System Resources</div>
      <ResourceBar label="CPU" used={r.used_cpu} total={r.total_cpu} unit=" cores" color="#00d4ff" />
      <ResourceBar label="GPU" used={r.used_gpu} total={r.total_gpu} unit=" units" color="#7b2ff7" />
      <ResourceBar label="RAM" used={r.used_ram} total={r.total_ram} unit=" GB" color="#00ff88" />
    </div>
  );
}
