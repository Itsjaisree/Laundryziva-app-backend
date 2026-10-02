import React, { useState } from 'react';
import { api } from '../api.js';
import { Empty, usePolling } from '../components/ui.jsx';
import { MACHINE_STATUS, formatWhen, machineStatus } from '../util.js';

const uptimeText = (s) => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

// Live status of every machine (refreshes every 15 seconds).
export default function Machines() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const data = await api('/machines');
      setMachines(data.machines || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, 15000, []);

  const counts = {};
  machines.forEach((m) => {
    const k = machineStatus(m).key;
    counts[k] = (counts[k] || 0) + 1;
  });
  const q = search.trim().toLowerCase();
  const shown = machines
    .filter((m) => !filter || machineStatus(m).key === filter)
    .filter((m) => !q || [m.friendly_name, m.location, m.device_id].some((v) => (v || '').toLowerCase().includes(q)));

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>Machines</h2><p className="muted">{machines.length} total</p></div>
      </div>
      <div className="stat-row">
        {Object.values(MACHINE_STATUS).map((st) => (
          <button key={st.key} className={`stat${filter === st.key ? ' stat-on' : ''}`} onClick={() => setFilter(filter === st.key ? '' : st.key)}>
            <span className="dot" style={{ background: st.color }} />
            <span className="stat-label">{st.label}</span>
            <b style={{ color: st.color }}>{counts[st.key] || 0}</b>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search name, location or device ID" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <Empty text="Loading…" /> : shown.length === 0 ? <Empty text="No machines match." /> : (
        <div className="machine-grid">
          {shown.map((m) => {
            const st = machineStatus(m);
            return (
              <div key={m.device_id} className="card machine">
                <div className="machine-top">
                  <div>
                    <div className="machine-name">{m.friendly_name || m.device_id}</div>
                    <div className="muted small">{m.location || 'No location'}</div>
                  </div>
                  <span className="status-pill" style={{ color: st.color, borderColor: st.color }}><span className="dot" style={{ background: st.color }} />{st.label}</span>
                </div>
                <div className="kv-grid kv-compact">
                  <div className="kv"><span>Signal</span><b>{m.rssi != null ? `${m.rssi} dBm${m.net ? ` (${m.net})` : ''}` : '—'}</b></div>
                  <div className="kv"><span>Uptime</span><b>{uptimeText(m.uptime)}</b></div>
                  <div className="kv"><span>Firmware</span><b>{m.firmware_version || '—'}</b></div>
                  <div className="kv"><span>Last seen</span><b>{m.last_seen_at ? formatWhen(m.last_seen_at) : '—'}</b></div>
                </div>
                <div className="muted small mono">{m.device_id}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
