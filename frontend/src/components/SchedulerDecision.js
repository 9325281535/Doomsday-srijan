import React from 'react';

const COMPONENT_CONFIG = [
  { key: 'urgency', label: 'Deadline Urgency', color: '#ef4444', icon: '⏰' },
  { key: 'priority', label: 'Base Priority', color: '#3b82f6', icon: '⭐' },
  { key: 'aging', label: 'Aging Bonus', color: '#00ff88', icon: '⏳' },
  { key: 'resource_fit', label: 'Resource Fit', color: '#7b2ff7', icon: '⚙️' },
];

export default function SchedulerDecision({ decision }) {
  if (!decision) {
    return (
      <div style={{ background: '#161b27', borderRadius: '12px', border: '1px solid #1e2840', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '200px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', alignSelf: 'flex-start', marginBottom: '8px' }}>🧠 Scheduler Decision</div>
        <div style={{ fontSize: '28px' }}>🤔</div>
        <div style={{ color: '#64748b', fontSize: '13px' }}>Waiting for first decision...</div>
      </div>
    );
  }

  const components = decision.components || {};
  const total = decision.total_score || 0;
  const maxVal = Math.max(...Object.values(components), 0.001);

  return (
    <div style={{ background: '#161b27', borderRadius: '12px', border: '1px solid #1e2840', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>🧠 Scheduler Decision</div>

      {/* Selected Job */}
      <div style={{ background: '#0d1117', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>SELECTED JOB</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>{decision.job_name || decision.job_id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>TOTAL SCORE</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#00d4ff', fontFamily: 'monospace' }}>
            {total >= 999 ? '∞' : total?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Preemption notice */}
      {decision.preempted_job && (
        <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '12px', color: '#ef4444' }}>
          ⚡ Preempted: <strong>{decision.preempted_job}</strong>
        </div>
      )}
      {decision.is_starvation_rescue && (
        <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '12px', color: '#f59e0b' }}>
          🛡️ Starvation rescue — forced execution
        </div>
      )}

      {/* Score breakdown bars */}
      <div style={{ marginBottom: '12px' }}>
        {COMPONENT_CONFIG.map(({ key, label, color, icon }) => {
          const val = components[key] || 0;
          const pct = maxVal > 0 ? (val / (total || 1)) * 100 : 0;
          return (
            <div key={key} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px' }}>
                <span style={{ color: '#94a3b8' }}>{icon} {label}</span>
                <span style={{ color, fontWeight: '700', fontFamily: 'monospace' }}>+{val.toFixed(3)}</span>
              </div>
              <div style={{ height: '6px', background: '#0d1117', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, borderRadius: '3px', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Reason */}
      {decision.reason && (
        <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
          <span style={{ color: '#64748b' }}>💡 Why? </span>{decision.reason}
        </div>
      )}
    </div>
  );
}
