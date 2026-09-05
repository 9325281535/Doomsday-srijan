import React, { useRef, useEffect } from 'react';

const EVENT_STYLES = {
  arrived: { color: '#3b82f6', icon: '📥' },
  started: { color: '#00ff88', icon: '▶️' },
  preempted: { color: '#ef4444', icon: '⚡' },
  completed: { color: '#94a3b8', icon: '✅' },
  warning: { color: '#f59e0b', icon: '⚠️' },
  ai_retrain: { color: '#7b2ff7', icon: '🤖' },
  default: { color: '#64748b', icon: '•' },
};

export default function EventLog({ events }) {
  const bottomRef = useRef(null);
  const items = events || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  return (
    <div style={{ background: '#161b27', borderRadius: '12px', border: '1px solid #1e2840', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📜 Live Event Log</span>
        <span style={{ background: '#1e2840', padding: '2px 8px', borderRadius: '10px', color: '#94a3b8' }}>{items.length} events</span>
      </div>

      <div style={{ height: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '13px' }}>Waiting for events...</div>
        )}
        {items.map((event, idx) => {
          const style = EVENT_STYLES[event.type] || EVENT_STYLES.default;
          return (
            <div key={idx} style={{ display: 'flex', gap: '10px', padding: '4px 6px', borderRadius: '4px', background: idx === items.length - 1 ? '#ffffff05' : 'transparent', alignItems: 'flex-start' }}>
              <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap', marginTop: '1px' }}>
                {event.time_str || '00:00:00'}
              </span>
              <span style={{ fontSize: '12px' }}>{style.icon}</span>
              <span style={{ fontSize: '12px', color: style.color, flex: 1, lineHeight: '1.4' }}>{event.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
