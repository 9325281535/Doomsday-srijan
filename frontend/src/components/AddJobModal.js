import React, { useState } from 'react';

const FIELD_STYLE = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #1e2840',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#f1f5f9',
  fontSize: '13px',
  outline: 'none',
};

export default function AddJobModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: '',
    priority: 'Medium',
    deadline_in_seconds: 60,
    burst_time: 10,
    cpu_units: 2,
    gpu_units: 0,
    ram_units: 4,
  });

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, deadline_in_seconds: parseFloat(form.deadline_in_seconds), burst_time: parseFloat(form.burst_time), cpu_units: parseInt(form.cpu_units), gpu_units: parseInt(form.gpu_units), ram_units: parseInt(form.ram_units) });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#0d1421', borderRadius: '16px', border: '1px solid #1e2840', width: '100%', maxWidth: '480px' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2840', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#00d4ff' }}>+ Add Custom Job</div>
          <button onClick={onClose} style={{ background: '#1e2840', border: 'none', color: '#94a3b8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>JOB NAME</label>
            <input style={FIELD_STYLE} value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. FraudDetection" required />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>PRIORITY</label>
            <select style={FIELD_STYLE} value={form.priority} onChange={e => update('priority', e.target.value)}>
              {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>DEADLINE (seconds): {form.deadline_in_seconds}s</label>
              <input type="range" min="5" max="120" value={form.deadline_in_seconds} onChange={e => update('deadline_in_seconds', e.target.value)} style={{ width: '100%', accentColor: '#00d4ff' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>BURST TIME: {form.burst_time}s</label>
              <input type="range" min="2" max="30" value={form.burst_time} onChange={e => update('burst_time', e.target.value)} style={{ width: '100%', accentColor: '#7b2ff7' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>CPU: {form.cpu_units}</label>
              <input type="range" min="1" max="8" value={form.cpu_units} onChange={e => update('cpu_units', e.target.value)} style={{ width: '100%', accentColor: '#00d4ff' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>GPU: {form.gpu_units}</label>
              <input type="range" min="0" max="2" value={form.gpu_units} onChange={e => update('gpu_units', e.target.value)} style={{ width: '100%', accentColor: '#7b2ff7' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>RAM: {form.ram_units}GB</label>
              <input type="range" min="1" max="16" value={form.ram_units} onChange={e => update('ram_units', e.target.value)} style={{ width: '100%', accentColor: '#00ff88' }} />
            </div>
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
