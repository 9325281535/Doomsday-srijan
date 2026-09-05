import React from 'react';

const PRIORITY_COLORS = {
  Critical: '#ef4444', High: '#f97316', Medium: '#3b82f6', Low: '#6b7280',
};

const scoreColor = (score) => {
  if (score >= 999) return '#f59e0b';
  if (score >= 8) return '#ef4444';
  if (score >= 6) return '#f97316';
  if (score >= 4) return '#eab308';
  return '#00ff88';
};

export default function ReadyQueue({ queue }) {
  const jobs = queue || [];
  return (
    <div style={{ background: '#161b27', borderRadius: '12px', border: '1px solid #1e2840', padding: '16px', height: '100%' }}>
      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📋 Ready Queue</span>
        <span style={{ background: '#1e2840', padding: '2px 8px', borderRadius: '10px', color: '#94a3b8' }}>{jobs.length} jobs</span>
      </div>

      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '13px' }}>Queue is empty</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['#', 'Job Name', 'Priority', 'Deadline', 'Wait', 'CPU/GPU/RAM', 'Score'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: '600', borderBottom: '1px solid #1e2840', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => {
                const sc = scoreColor(job.score);
                const pc = PRIORITY_COLORS[job.priority] || '#6b7280';
                const isTop = idx === 0;
                const ttd = Math.max(0, job.deadline - Date.now() / 1000);
                return (
                  <tr key={job.id} style={{
                    background: isTop ? '#00d4ff08' : 'transparent',
                    borderLeft: isTop ? '2px solid #00d4ff' : '2px solid transparent',
                    transition: 'all 0.3s',
                  }}>
                    <td style={{ padding: '7px 8px', color: '#64748b' }}>
                      {isTop ? <span style={{ color: '#00d4ff', fontWeight: '700' }}>→</span> : idx + 1}
                    </td>
                    <td style={{ padding: '7px 8px', color: '#f1f5f9', fontWeight: isTop ? '700' : '400', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.name}
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', color: pc, background: pc + '22', border: `1px solid ${pc}44` }}>
                        {job.priority}
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px', color: ttd < 10 ? '#ef4444' : '#94a3b8', fontFamily: 'monospace' }}>
                      {ttd.toFixed(1)}s
                    </td>
                    <td style={{ padding: '7px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {job.wait_time?.toFixed(1)}s
                    </td>
                    <td style={{ padding: '7px 8px', color: '#64748b', fontSize: '11px' }}>
                      {job.cpu_units}c/{job.gpu_units}g/{job.ram_units}G
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <span style={{ fontWeight: '700', color: sc, fontFamily: 'monospace' }}>
                        {job.score >= 999 ? '∞' : job.score?.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
