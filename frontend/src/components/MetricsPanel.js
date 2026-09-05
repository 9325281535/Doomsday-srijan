import React from 'react';

const MetricCard = ({ label, value, unit, color, icon, warn }) => (
  <div style={{ background: '#161b27', borderRadius: '10px', border: `1px solid ${warn ? color + '44' : '#1e2840'}`, padding: '12px 16px', flex: '1', minWidth: '120px' }}>
    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '22px', fontWeight: '800', color: warn ? color : '#f1f5f9', fontFamily: 'monospace' }}>
      {value}{unit}
    </div>
  </div>
);

export default function MetricsPanel({ metrics }) {
  const m = metrics || {};
  const missRate = ((m.deadline_miss_rate || 0) * 100).toFixed(1);
  const cpuUtil = ((m.cpu_utilization || 0) * 100).toFixed(0);
  const gpuUtil = ((m.gpu_utilization || 0) * 100).toFixed(0);

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <MetricCard label="Deadline Miss Rate" value={missRate} unit="%" icon="⏰" color="#ef4444" warn={parseFloat(missRate) > 5} />
      <MetricCard label="Avg Wait Time" value={(m.avg_wait_time || 0).toFixed(1)} unit="s" icon="⏳" color="#f59e0b" warn={(m.avg_wait_time || 0) > 15} />
      <MetricCard label="Throughput" value={(m.throughput || 0).toFixed(1)} unit="/min" icon="🚀" color="#00ff88" warn={false} />
      <MetricCard label="CPU Utilization" value={cpuUtil} unit="%" icon="🖥️" color="#00d4ff" warn={parseInt(cpuUtil) > 90} />
      <MetricCard label="GPU Utilization" value={gpuUtil} unit="%" icon="🔲" color="#7b2ff7" warn={parseInt(gpuUtil) > 90} />
      <MetricCard label="Jobs Completed" value={m.completed_count || 0} unit="" icon="✅" color="#00ff88" warn={false} />
      <MetricCard label="Deadline Misses" value={m.deadline_misses || 0} unit="" icon="❌" color="#ef4444" warn={(m.deadline_misses || 0) > 0} />
      <MetricCard label="Starvation Fixed" value={m.starved_jobs_prevented || 0} unit="" icon="🛡️" color="#f59e0b" warn={false} />
    </div>
  );
}
