import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { addDays, dateKey, formatDay, timeToMinutes } from '../util.js';
import { Empty, StatusBadge, Badge } from '../components/ui.jsx';
import TaskForm from '../components/TaskForm.jsx';

const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'today', label: 'Today' },
  { key: 'next', label: 'Next week' },
  { key: 'all', label: 'All upcoming' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'custom', label: 'Pick dates' },
];

// Scheduled work for a range, grouped by day. Support never has to click a date to see next week.
export default function Work() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [tech, setTech] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/technician/tasks', { params: { all: 'true' } });
      setTasks(data.tasks || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const now = new Date();
  const todayKey = dateKey(now);
  const tomorrowKey = dateKey(addDays(now, 1));
  const weekEnd = dateKey(addDays(now, (7 - now.getDay()) % 7));
  const nextMonday = addDays(now, ((8 - now.getDay()) % 7) || 7);
  const nextStart = dateKey(nextMonday);
  const nextEnd = dateKey(addDays(nextMonday, 6));

  const technicians = useMemo(() => [...new Set(tasks.map((t) => t.technician_name).filter(Boolean))].sort(), [tasks]);
  const overdue = tasks.filter((t) => t.scheduled_date && t.scheduled_date < todayKey && t.status !== 'Completed');

  const inRange = (t) => {
    const d = t.scheduled_date;
    if (range === 'overdue') return overdue.includes(t);
    if (range === 'all') return !d || d >= todayKey;
    if (range === 'custom') return d && (!from || d >= from) && (!to || d <= to);
    if (!d) return false;
    if (range === 'today') return d === todayKey;
    if (range === 'week') return d >= todayKey && d <= weekEnd;
    return d >= nextStart && d <= nextEnd;
  };

  const q = search.trim().toLowerCase();
  const shown = tasks
    .filter(inRange)
    .filter((t) => !status || t.status === status)
    .filter((t) => !tech || (tech === '__none' ? !t.technician_name : t.technician_name === tech))
    .filter((t) => !q || [t.title, t.machine_label, t.machine_name, t.location, t.technician_name].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999') || timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));

  const groups = [];
  shown.forEach((t) => {
    const key = t.scheduled_date || 'none';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(t);
    else groups.push({ key, items: [t] });
  });

  const heading = (key) => {
    if (key === 'none') return 'No date set';
    const text = formatDay(key);
    return key === todayKey ? `Today · ${text}` : key === tomorrowKey ? `Tomorrow · ${text}` : text;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Scheduled work</h2>
          <p className="muted">{shown.length} task{shown.length === 1 ? '' : 's'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New task</button>
      </div>

      <div className="toolbar">
        <div className="chips">
          {RANGES.map((r) => (
            <button key={r.key} className={`chip${range === r.key ? ' chip-on' : ''}${r.key === 'overdue' && overdue.length && range !== 'overdue' ? ' chip-warn' : ''}`} onClick={() => setRange(r.key)}>
              {r.label}{r.key === 'overdue' && overdue.length ? ` (${overdue.length})` : ''}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <div className="date-pair">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        ) : null}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search title, machine, location, technician" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {['Unassigned', 'Assigned', 'In Progress', 'Pending Approval', 'Completed'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="">Any technician</option>
          <option value="__none">Unassigned</option>
          {technicians.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <Empty text="Loading…" /> : groups.length === 0 ? <Empty text="Nothing to show for these filters." /> : (
        groups.map((g) => (
          <section key={g.key} className="day-group">
            <h4 className={g.key !== 'none' && g.key < todayKey ? 'late' : ''}>{heading(g.key)} <span>· {g.items.length}</span></h4>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Time</th><th>Task</th><th>Machine</th><th>Technician</th><th>Location</th><th>Priority</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {g.items.map((t) => (
                    <tr key={t.id} className={t.status === 'Completed' ? 'row-done' : ''}>
                      <td className="nowrap">{t.scheduled_time || '—'}</td>
                      <td><Link to={`/support/tasks/${t.id}`} className="link-strong">{t.title}</Link></td>
                      <td>{t.machine_label || t.machine_name || '—'}</td>
                      <td>{t.technician_name || <span className="muted">Unassigned</span>}</td>
                      <td>{t.location || '—'}</td>
                      <td>{t.priority === 'High' ? <Badge tone="red">High</Badge> : t.priority || '—'}</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {creating ? <TaskForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} /> : null}
    </div>
  );
}
