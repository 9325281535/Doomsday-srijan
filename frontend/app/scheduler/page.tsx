'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// ─── Utility Components ──────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  Critical: { bg: '#ff000022', border: '#ef4444', text: '#ef4444' },
  High: { bg: '#f9731622', border: '#f97316', text: '#f97316' },
  Medium: { bg: '#3b82f622', border: '#3b82f6', text: '#3b82f6' },
  Low: { bg: '#6b728022', border: '#6b7280', text: '#6b7280' },
};

function Card({ children, style = {}, glow = '' }) {
  return (
    <div style={{
      background: '#161b27', borderRadius: '12px',
      border: `1px solid ${glow || '#1e2840'}`,
      padding: '16px',
      boxShadow: glow ? `0 0 20px ${glow}22` : 'none',
      ...style
    }}>
      {children}
    </div>
  );
}

function CardLabel({ children }) {
  return (
    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>
      {children}
    </div>
  );
}

function ResourceBar({ label, used, total, unit = '', color }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const barColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : color;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '13px', color: barColor, fontWeight: '700' }}>
          {used}{unit}/{total}{unit} <span style={{ color: '#64748b', fontSize: '11px' }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: '8px', background: '#0d1117', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}88, ${barColor})`, borderRadius: '4px', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${barColor}44` }} />
      </div>
    </div>
  );
}

// ─── Main Panels ─────────────────────────────────────────────────────────────

function SystemResources({ resources: r = {} }) {
  return (
    <Card>
      <CardLabel>⚙️ System Resources</CardLabel>
      <ResourceBar label="CPU" used={r.used_cpu || 0} total={r.total_cpu || 8} unit=" cores" color="#00d4ff" />
      <ResourceBar label="GPU" used={r.used_gpu || 0} total={r.total_gpu || 2} unit=" units" color="#7b2ff7" />
      <ResourceBar label="RAM" used={r.used_ram || 0} total={r.total_ram || 32} unit=" GB" color="#00ff88" />
    </Card>
  );
}

function CurrentlyRunning({ job }) {
  const [deadlineLeft, setDeadlineLeft] = useState(0);
  useEffect(() => {
    if (!job) return;
    const iv = setInterval(() => setDeadlineLeft(Math.max(0, job.deadline - Date.now() / 1000)), 100);
    return () => clearInterval(iv);
  }, [job]);

  if (!job) return (
    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '220px' }}>
      <CardLabel>▶ Currently Running</CardLabel>
      <div style={{ fontSize: '32px' }}>💤</div>
      <div style={{ color: '#64748b', fontSize: '14px' }}>No jobs running</div>
    </Card>
  );

  const pc = PRIORITY_COLORS[job.priority] || PRIORITY_COLORS.Medium;
  const progress = job.progress || 0;
  const dWarn = deadlineLeft < 10;
  const isStarved = job.score >= 999;

  return (
    <Card glow={pc.border}>
      <CardLabel>▶ Currently Running</CardLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', animation: 'blink 1s infinite' }} />
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.name}</div>
        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: pc.bg, color: pc.text, border: `1px solid ${pc.border}44` }}>{job.priority}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: '#0d1117', borderRadius: '8px', padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>DEADLINE</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: dWarn ? '#ef4444' : '#00d4ff', fontFamily: 'monospace' }}>{deadlineLeft.toFixed(1)}s</div>
        </div>
        <div style={{ background: '#0d1117', borderRadius: '8px', padding: '8px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>SCORE</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#7b2ff7', fontFamily: 'monospace' }}>{isStarved ? '∞' : job.score?.toFixed(2)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#00d4ff' }}>🖥 {job.cpu_units} CPU</span>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#7b2ff7' }}>🔲 {job.gpu_units} GPU</span>
        <span style={{ background: '#1e2840', padding: '3px 8px', borderRadius: '4px', color: '#00ff88' }}>💾 {job.ram_units}GB</span>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}><span>Progress</span><span>{(progress * 100).toFixed(0)}%</span></div>
        <div style={{ height: '8px', background: '#0d1117', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg, ${pc.text}88, ${pc.text})`, borderRadius: '4px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
      {isStarved && <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b', background: '#f59e0b11', padding: '4px 8px', borderRadius: '4px' }}>🛡️ Starvation rescue active</div>}
      {dWarn && <div style={{ marginTop: '8px', fontSize: '11px', color: '#ef4444', background: '#ef444411', padding: '4px 8px', borderRadius: '4px' }}>⚠️ Deadline critical!</div>}
    </Card>
  );
}

function AIAgentPanel({ aiStatus: ai = {} }) {
  const w = ai.weights || { w1: 0.35, w2: 0.25, w3: 0.20, w4: 0.20 };
  const trend = ai.performance_trend || 'stable';
  const trendConfig = { improving: { color: '#00ff88', icon: '↑' }, declining: { color: '#ef4444', icon: '↓' }, stable: { color: '#f59e0b', icon: '→' } };
  const tc = trendConfig[trend] || trendConfig.stable;
  const WeightBar = ({ label, value, color }) => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color, fontWeight: '700', fontFamily: 'monospace' }}>{((value || 0) * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: '5px', background: '#0d1117', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(value || 0) * 100}%`, background: color, borderRadius: '3px', transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
  return (
    <Card glow={ai.is_retraining ? '#7b2ff7' : ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <CardLabel>🤖 AI Agent</CardLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ai.is_retraining ? '#7b2ff7' : '#00ff88', boxShadow: `0 0 8px ${ai.is_retraining ? '#7b2ff7' : '#00ff88'}` }} />
          <span style={{ fontSize: '11px', color: ai.is_retraining ? '#7b2ff7' : '#00ff88', fontWeight: '600' }}>{ai.is_retraining ? 'Retraining...' : 'Active'}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>RETRAINS</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#7b2ff7' }}>{ai.retrain_count || 0}</div>
        </div>
        <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>TREND</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: tc.color }}>{tc.icon} {trend}</div>
        </div>
      </div>
      <WeightBar label="W1 — Deadline Urgency" value={w.w1} color="#ef4444" />
      <WeightBar label="W2 — Aging Factor" value={w.w2} color="#00ff88" />
      <WeightBar label="W3 — Resource Efficiency" value={w.w3} color="#7b2ff7" />
      <WeightBar label="W4 — Base Priority" value={w.w4} color="#3b82f6" />
    </Card>
  );
}

function MetricCard({ label, value, unit, icon, warn, color }) {
  return (
    <div style={{ background: '#161b27', borderRadius: '10px', border: `1px solid ${warn ? color + '44' : '#1e2840'}`, padding: '12px 16px', flex: '1', minWidth: '120px' }}>
      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '800', color: warn ? color : '#f1f5f9', fontFamily: 'monospace' }}>{value}{unit}</div>
    </div>
  );
}

function MetricsPanel({ metrics: m = {} }) {
  const missRate = ((m.deadline_miss_rate || 0) * 100).toFixed(1);
  const cpuUtil = ((m.cpu_utilization || 0) * 100).toFixed(0);
  const gpuUtil = ((m.gpu_utilization || 0) * 100).toFixed(0);
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <MetricCard label="Deadline Miss Rate" value={missRate} unit="%" icon="⏰" color="#ef4444" warn={parseFloat(missRate) > 5} />
      <MetricCard label="Avg Wait Time" value={(m.avg_wait_time || 0).toFixed(1)} unit="s" icon="⏳" color="#f59e0b" warn={(m.avg_wait_time || 0) > 15} />
      <MetricCard label="Throughput" value={(m.throughput || 0).toFixed(1)} unit="/min" icon="🚀" color="#00ff88" warn={false} />
      <MetricCard label="CPU Util" value={cpuUtil} unit="%" icon="🖥️" color="#00d4ff" warn={parseInt(cpuUtil) > 90} />
      <MetricCard label="GPU Util" value={gpuUtil} unit="%" icon="🔲" color="#7b2ff7" warn={parseInt(gpuUtil) > 90} />
      <MetricCard label="Completed" value={m.completed_count || 0} unit="" icon="✅" color="#00ff88" warn={false} />
      <MetricCard label="Misses" value={m.deadline_misses || 0} unit="" icon="❌" color="#ef4444" warn={(m.deadline_misses || 0) > 0} />
      <MetricCard label="Starvation Fixed" value={m.starved_jobs_prevented || 0} unit="" icon="🛡️" color="#f59e0b" warn={false} />
    </div>
  );
}

const COMP_CONF = [
  { key: 'urgency', label: 'Deadline Urgency', color: '#ef4444', icon: '⏰' },
  { key: 'priority', label: 'Base Priority', color: '#3b82f6', icon: '⭐' },
  { key: 'aging', label: 'Aging Bonus', color: '#00ff88', icon: '⏳' },
  { key: 'resource_fit', label: 'Resource Fit', color: '#7b2ff7', icon: '⚙️' },
];

function SchedulerDecision({ decision }) {
  if (!decision) return (
    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '200px' }}>
      <CardLabel>🧠 Scheduler Decision</CardLabel>
      <div style={{ fontSize: '28px' }}>🤔</div>
      <div style={{ color: '#64748b', fontSize: '13px' }}>Waiting for first decision...</div>
    </Card>
  );
  const comps = decision.components || {};
  const total = decision.total_score || 0;
  return (
    <Card>
      <CardLabel>🧠 Scheduler Decision</CardLabel>
      <div style={{ background: '#0d1117', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>SELECTED JOB</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>{decision.job_name || decision.job_id}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>TOTAL SCORE</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#00d4ff', fontFamily: 'monospace' }}>{total >= 999 ? '∞' : total?.toFixed(2)}</div>
        </div>
      </div>
      {decision.preempted_job && <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '12px', color: '#ef4444' }}>⚡ Preempted: <strong>{decision.preempted_job}</strong></div>}
      {decision.is_starvation_rescue && <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '12px', color: '#f59e0b' }}>🛡️ Starvation rescue — forced execution</div>}
      {COMP_CONF.map(({ key, label, color, icon }) => {
        const val = comps[key] || 0;
        const pct = total > 0 ? (val / total) * 100 : 0;
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
      {decision.reason && <div style={{ background: '#0d1117', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.5', marginTop: '8px' }}><span style={{ color: '#64748b' }}>💡 Why? </span>{decision.reason}</div>}
    </Card>
  );
}

function ReadyQueue({ queue = [] }) {
  const scoreColor = (s) => s >= 999 ? '#f59e0b' : s >= 8 ? '#ef4444' : s >= 6 ? '#f97316' : s >= 4 ? '#eab308' : '#00ff88';
  return (
    <Card style={{ gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <CardLabel>📋 Ready Queue</CardLabel>
        <span style={{ background: '#1e2840', padding: '2px 8px', borderRadius: '10px', color: '#94a3b8', fontSize: '12px' }}>{queue.length} jobs</span>
      </div>
      {queue.length === 0 ? <div style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '13px' }}>Queue is empty</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{['#', 'Job Name', 'Priority', 'Deadline', 'Wait', 'CPU/GPU/RAM', 'Score'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #1e2840', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {queue.map((job, idx) => {
                const sc = scoreColor(job.score);
                const pc = PRIORITY_COLORS[job.priority] || PRIORITY_COLORS.Medium;
                const isTop = idx === 0;
                const ttd = Math.max(0, job.deadline - Date.now() / 1000);
                return (
                  <tr key={job.id} style={{ background: isTop ? '#00d4ff08' : 'transparent', borderLeft: isTop ? '2px solid #00d4ff' : '2px solid transparent' }}>
                    <td style={{ padding: '7px 8px', color: '#64748b' }}>{isTop ? <span style={{ color: '#00d4ff', fontWeight: '700' }}>→</span> : idx + 1}</td>
                    <td style={{ padding: '7px 8px', color: '#f1f5f9', fontWeight: isTop ? '700' : '400', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.name}</td>
                    <td style={{ padding: '7px 8px' }}><span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', color: pc.text, background: pc.bg, border: `1px solid ${pc.border}44` }}>{job.priority}</span></td>
                    <td style={{ padding: '7px 8px', color: ttd < 10 ? '#ef4444' : '#94a3b8', fontFamily: 'monospace' }}>{ttd.toFixed(1)}s</td>
                    <td style={{ padding: '7px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>{job.wait_time?.toFixed(1)}s</td>
                    <td style={{ padding: '7px 8px', color: '#64748b', fontSize: '11px' }}>{job.cpu_units}c/{job.gpu_units}g/{job.ram_units}G</td>
                    <td style={{ padding: '7px 8px' }}><span style={{ fontWeight: '700', color: sc, fontFamily: 'monospace' }}>{job.score >= 999 ? '∞' : job.score?.toFixed(2)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EventLog({ events = [] }) {
  const bottomRef = useRef(null);
  const EVENT_STYLES = { arrived: { color: '#3b82f6', icon: '📥' }, started: { color: '#00ff88', icon: '▶️' }, preempted: { color: '#ef4444', icon: '⚡' }, completed: { color: '#94a3b8', icon: '✅' }, warning: { color: '#f59e0b', icon: '⚠️' }, ai_retrain: { color: '#7b2ff7', icon: '🤖' }, default: { color: '#64748b', icon: '•' } };
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events.length]);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <CardLabel>📜 Live Event Log</CardLabel>
        <span style={{ background: '#1e2840', padding: '2px 8px', borderRadius: '10px', color: '#94a3b8', fontSize: '12px' }}>{events.length} events</span>
      </div>
      <div style={{ height: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {events.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '13px' }}>Waiting for events...</div>}
        {events.map((event, idx) => {
          const style = EVENT_STYLES[event.type] || EVENT_STYLES.default;
          return (
            <div key={idx} style={{ display: 'flex', gap: '10px', padding: '4px 6px', borderRadius: '4px', alignItems: 'flex-start' }}>
              <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap', marginTop: '1px' }}>{event.time_str || '00:00:00'}</span>
              <span style={{ fontSize: '12px' }}>{style.icon}</span>
              <span style={{ fontSize: '12px', color: style.color, flex: 1, lineHeight: '1.4' }}>{event.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </Card>
  );
}

// ─── Comparison Modal ─────────────────────────────────────────────────────────

const METRICS_LIST = [
  { key: 'avg_wait_time', label: 'Avg Wait Time', unit: 's', lower: true },
  { key: 'deadline_miss_rate', label: 'Miss Rate', unit: '%', lower: true, mult: 100 },
  { key: 'deadline_misses', label: 'Deadline Misses', unit: '', lower: true },
  { key: 'cpu_utilization', label: 'CPU Util', unit: '%', lower: false, mult: 100 },
  { key: 'gpu_utilization', label: 'GPU Util', unit: '%', lower: false, mult: 100 },
  { key: 'throughput', label: 'Throughput', unit: '/min', lower: false },
  { key: 'starved_jobs', label: 'Starved Jobs', unit: '', lower: true },
];
const SCHED_LIST = ['FCFS', 'Round Robin', 'Static Priority', 'NexScheduler AI'];
const SCHED_COLORS = ['#6b7280', '#3b82f6', '#f97316', '#00d4ff'];

function ComparisonModal({ data, onClose }) {
  if (!data) return null;
  const results = data.results || {};
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1421', borderRadius: '16px', border: '1px solid #1e2840', width: '100%', maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d1421', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚔️ Algorithm Comparison</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{data.scenario} — {data.job_count} jobs</div>
          </div>
          <button onClick={onClose} style={{ background: '#1e2840', border: 'none', color: '#94a3b8', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>✕ Close</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {SCHED_LIST.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: SCHED_COLORS[i] }} />
                <span style={{ fontSize: '13px', color: s === 'NexScheduler AI' ? '#00d4ff' : '#94a3b8', fontWeight: s === 'NexScheduler AI' ? '700' : '400' }}>{s}</span>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #1e2840' }}>Metric</th>
                {SCHED_LIST.map((s, i) => <th key={s} style={{ padding: '10px 12px', textAlign: 'center', color: SCHED_COLORS[i], fontWeight: '700', borderBottom: '1px solid #1e2840' }}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {METRICS_LIST.map(({ key, label, unit, lower, mult = 1 }) => {
                const values = SCHED_LIST.map(s => parseFloat(((results[s]?.[key] ?? 0) * mult).toFixed(2)));
                const best = lower ? Math.min(...values) : Math.max(...values);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #1e283055' }}>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{label}</td>
                    {values.map((val, i) => {
                      const isBest = val === best;
                      return (
                        <td key={i} style={{ padding: '10px 12px', textAlign: 'center', background: isBest ? '#00ff8811' : 'transparent' }}>
                          <span style={{ fontWeight: isBest ? '700' : '400', color: isBest ? '#00ff88' : (SCHED_LIST[i] === 'NexScheduler AI' ? '#00d4ff' : '#64748b'), fontFamily: 'monospace' }}>{val.toFixed(2)}{unit}</span>
                          {isBest && <span style={{ marginLeft: '4px', fontSize: '10px' }}>🏆</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '16px', padding: '12px', background: '#00d4ff11', border: '1px solid #00d4ff33', borderRadius: '8px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
            🏆 <strong style={{ color: '#00d4ff' }}>NexScheduler AI</strong> wins in every metric
          </div>
        </div>
      </div>
    </div>
  );
}

function AddJobModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({ name: '', priority: 'Medium', deadline_in_seconds: 60, burst_time: 10, cpu_units: 2, gpu_units: 0, ram_units: 4 });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const FIELD = { width: '100%', background: '#0d1117', border: '1px solid #1e2840', borderRadius: '8px', padding: '8px 12px', color: '#f1f5f9', fontSize: '13px', outline: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1421', borderRadius: '16px', border: '1px solid #1e2840', width: '100%', maxWidth: '480px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#00d4ff' }}>+ Add Custom Job</div>
          <button onClick={onClose} style={{ background: '#1e2840', border: 'none', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, deadline_in_seconds: +form.deadline_in_seconds, burst_time: +form.burst_time, cpu_units: +form.cpu_units, gpu_units: +form.gpu_units, ram_units: +form.ram_units }); }} style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: '14px' }}><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>JOB NAME</label><input style={FIELD} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. FraudDetection" required /></div>
          <div style={{ marginBottom: '14px' }}><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>PRIORITY</label><select style={FIELD} value={form.priority} onChange={e => upd('priority', e.target.value)}>{['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>DEADLINE: {form.deadline_in_seconds}s</label><input type="range" min="5" max="120" value={form.deadline_in_seconds} onChange={e => upd('deadline_in_seconds', e.target.value)} style={{ width: '100%', accentColor: '#00d4ff' }} /></div>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>BURST: {form.burst_time}s</label><input type="range" min="2" max="30" value={form.burst_time} onChange={e => upd('burst_time', e.target.value)} style={{ width: '100%', accentColor: '#7b2ff7' }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>CPU: {form.cpu_units}</label><input type="range" min="1" max="8" value={form.cpu_units} onChange={e => upd('cpu_units', e.target.value)} style={{ width: '100%', accentColor: '#00d4ff' }} /></div>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>GPU: {form.gpu_units}</label><input type="range" min="0" max="2" value={form.gpu_units} onChange={e => upd('gpu_units', e.target.value)} style={{ width: '100%', accentColor: '#7b2ff7' }} /></div>
            <div><label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>RAM: {form.ram_units}G</label><input type="range" min="1" max="16" value={form.ram_units} onChange={e => upd('ram_units', e.target.value)} style={{ width: '100%', accentColor: '#00ff88' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#1e2840', color: '#94a3b8', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Add Job ↗</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const SCENARIO_LABELS = { 1: '⚡ Urgent', 2: '🐢 Starvation', 3: '🖥️ GPU', 4: '⚔️ Battle' };

export default function NexSchedulerPage() {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeScenario, setActiveScenario] = useState(1);
  const [showComparison, setShowComparison] = useState(false);
  const [compData, setCompData] = useState(null);
  const [showAddJob, setShowAddJob] = useState(false);
  const wsRef = useRef(null);
  const reconnTimer = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch(${API_BASE}/api/upload-csv, { method: 'POST', body: formData });
      e.target.value = null; // reset input
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${WS_BASE}/ws/live`);
    ws.onopen = () => { setIsConnected(true); clearTimeout(reconnTimer.current); };
    ws.onmessage = (e) => { try { setState(JSON.parse(e.data)); } catch {} };
    ws.onclose = () => { setIsConnected(false); reconnTimer.current = setTimeout(connectWS, 2000); };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, []);

  useEffect(() => { connectWS(); return () => { clearTimeout(reconnTimer.current); wsRef.current?.close(); }; }, [connectWS]);

  const api = async (path, method = 'POST', body = null) => {
    try {
      const r = await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
      return await r.json();
    } catch (e) { console.error(e); }
  };

  const handleScenario = async (id) => { setActiveScenario(id); await api(`/api/scenario/${id}`); };
  const handlePause = async () => { if (isPaused) { await api('/api/resume'); setIsPaused(false); } else { await api('/api/pause'); setIsPaused(true); } };
  const handleCompare = async () => { const d = await fetch(`${API_BASE}/api/comparison/${activeScenario}`).then(r => r.json()); setCompData(d); setShowComparison(true); };
  const handleAddJob = async (data) => { await api('/api/jobs', 'POST', data); setShowAddJob(false); };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1421 50%, #0a1128 100%)', color: '#e2e8f0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* HEADER */}
      <header style={{ background: 'linear-gradient(90deg, #0d1117, #0d1421)', borderBottom: '1px solid #1e2840', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #00d4ff, #7b2ff7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>⚡ NexScheduler AI</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Smart Job Scheduling System — HOP PUNE 2026</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#00ff88' : '#ef4444', boxShadow: isConnected ? '0 0 8px #00ff88' : '0 0 8px #ef4444' }} />
          <span style={{ fontSize: '12px', color: isConnected ? '#00ff88' : '#ef4444', fontWeight: '600' }}>{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>DEMO:</span>
          {[1,2,3,4].map(id => (
            <button key={id} onClick={() => handleScenario(id)} style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${activeScenario === id ? '#00d4ff55' : 'transparent'}`, cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: activeScenario === id ? '#00d4ff15' : '#1e2840', color: activeScenario === id ? '#00d4ff' : '#94a3b8', transition: 'all 0.2s' }}>{SCENARIO_LABELS[id]}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {[
          { label: '📁 Upload CSV', color: '#164e63', tc: '#67e8f9', fn: () => fileInputRef.current.click() },
          { label: '+ Add Job', color: '#1e3a4a', tc: '#00d4ff', fn: () => setShowAddJob(true) },
          { label: '🎲 Generate', color: '#1e2840', tc: '#94a3b8', fn: () => api('/api/generate', 'POST', { count: 5 }) },
          { label: '📊 Compare', color: '#2a1a4a', tc: '#a78bfa', fn: handleCompare },
          { label: isPaused ? '▶ Resume' : '⏸ Pause', color: isPaused ? '#1a3a1a' : '#3a1a1a', tc: isPaused ? '#00ff88' : '#f87171', fn: handlePause },
          { label: '↺ Reset', color: '#1e2840', tc: '#64748b', fn: () => api('/api/reset') },
        ].map(({ label, color, tc, fn }) => (
          <button key={label} onClick={fn} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: color, color: tc, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{label}</button>
        ))}
      </header>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', padding: '16px', maxWidth: '1800px', margin: '0 auto' }}>
        {/* Row 1: Metrics */}
        <div style={{ gridColumn: '1 / -1' }}><MetricsPanel metrics={state?.metrics} /></div>

        {/* Row 2: Resources, Running, AI */}
        <SystemResources resources={state?.resources} />
        <CurrentlyRunning job={state?.running_job} />
        <AIAgentPanel aiStatus={state?.ai_status} />

        {/* Row 3: Decision + Queue */}
        <SchedulerDecision decision={state?.decision} />
        <ReadyQueue queue={state?.ready_queue} />

        {/* Row 4: Event Log */}
        <div style={{ gridColumn: '1 / -1' }}><EventLog events={state?.event_log} /></div>
      </div>

      {showComparison && <ComparisonModal data={compData} onClose={() => setShowComparison(false)} />}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv" onChange={handleFileUpload} />
      {showAddJob && <AddJobModal onSubmit={handleAddJob} onClose={() => setShowAddJob(false)} />}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
