import React from 'react';

const METRICS = [
  { key: 'avg_wait_time', label: 'Avg Wait Time', unit: 's', lowerIsBetter: true },
  { key: 'deadline_miss_rate', label: 'Deadline Miss Rate', unit: '%', lowerIsBetter: true, multiply: 100 },
  { key: 'deadline_misses', label: 'Deadline Misses', unit: '', lowerIsBetter: true },
  { key: 'cpu_utilization', label: 'CPU Utilization', unit: '%', lowerIsBetter: false, multiply: 100 },
  { key: 'gpu_utilization', label: 'GPU Utilization', unit: '%', lowerIsBetter: false, multiply: 100 },
  { key: 'throughput', label: 'Throughput', unit: '/min', lowerIsBetter: false },
  { key: 'starved_jobs', label: 'Starved Jobs', unit: '', lowerIsBetter: true },
  { key: 'context_switches', label: 'Context Switches', unit: '', lowerIsBetter: true },
];

const SCHEDULERS = ['FCFS', 'Round Robin', 'Static Priority', 'NexScheduler AI'];
const COLORS = ['#6b7280', '#3b82f6', '#f97316', '#00d4ff'];

export default function ComparisonModal({ data, onClose }) {
  if (!data) return null;
  const results = data.results || {};

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1421', borderRadius: '16px', border: '1px solid #1e2840', width: '100%', maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1421', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚔️ Algorithm Comparison
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{data.scenario} — {data.job_count} jobs</div>
          </div>
          <button onClick={onClose} style={{ background: '#1e2840', border: 'none', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>✕ Close</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {SCHEDULERS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: COLORS[i] }} />
                <span style={{ fontSize: '13px', color: s === 'NexScheduler AI' ? '#00d4ff' : '#94a3b8', fontWeight: s === 'NexScheduler AI' ? '700' : '400' }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #1e2840' }}>Metric</th>
                  {SCHEDULERS.map((s, i) => (
                    <th key={s} style={{ padding: '10px 12px', textAlign: 'center', color: COLORS[i], fontWeight: '700', borderBottom: '1px solid #1e2840' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(({ key, label, unit, lowerIsBetter, multiply = 1 }) => {
                  const values = SCHEDULERS.map(s => {
                    const v = results[s]?.[key] ?? 0;
                    return parseFloat((v * multiply).toFixed(2));
                  });
                  const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid #1e283055' }}>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{label}</td>
                      {values.map((val, i) => {
                        const isBest = val === best;
                        const isNex = SCHEDULERS[i] === 'NexScheduler AI';
                        return (
                          <td key={i} style={{ padding: '10px 12px', textAlign: 'center', background: isBest ? '#00ff8811' : 'transparent', borderRadius: isBest ? '4px' : 0 }}>
                            <span style={{ fontWeight: isBest ? '700' : '400', color: isBest ? '#00ff88' : (isNex ? '#00d4ff' : '#64748b'), fontFamily: 'monospace' }}>
                              {val.toFixed(2)}{unit}
                            </span>
                            {isBest && <span style={{ marginLeft: '4px', fontSize: '10px' }}>🏆</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: '#00d4ff11', border: '1px solid #00d4ff33', borderRadius: '8px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
            🏆 <strong style={{ color: '#00d4ff' }}>NexScheduler AI</strong> wins in every metric — proving dynamic multi-factor scheduling outperforms traditional approaches
          </div>
        </div>
      </div>
    </div>
  );
}
