import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Modal } from './ui.jsx';
import { useToast } from '../toast.jsx';

const PRIORITIES = ['Low', 'Medium', 'High'];
const TYPES = ['Maintenance', 'Repair', 'Installation', 'Inspection'];

// Create (task omitted) or edit a task. Support picks the technician, machine, date and time.
export default function TaskForm({ task, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!task;
  const [technicians, setTechnicians] = useState([]);
  const [machines, setMachines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({
    title: task?.title || '',
    type: task?.type || 'Maintenance',
    description: task?.description || '',
    machine_id: task?.machine_id || '',
    location: task?.location || '',
    technician_id: task?.technician_id || '',
    scheduled_date: task?.scheduled_date || '',
    scheduled_time: task?.scheduled_time || '',
    priority: task?.priority || 'Medium',
  });
  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    api('/users', { params: { role_key: 'field_operations' } }).then((d) => setTechnicians((d.users || []).filter((u) => u.is_active === 1))).catch(() => {});
    api('/machines').then((d) => setMachines(d.machines || [])).catch(() => {});
  }, []);

  const pickMachine = (id) => {
    set('machine_id', id);
    const m = machines.find((x) => x.device_id === id);
    if (m && !f.location) set('location', m.location || '');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return setError('Give the task a title');
    setBusy(true);
    setError('');
    const machine = machines.find((x) => x.device_id === f.machine_id);
    const body = {
      title: f.title.trim(),
      type: f.type,
      description: f.description.trim() || null,
      location: f.location.trim() || null,
      machine_id: f.machine_id || null,
      machine_name: machine ? machine.friendly_name || null : null,
      technician_id: f.technician_id || null,
      scheduled_date: f.scheduled_date || null,
      scheduled_time: f.scheduled_time.trim() || null,
      priority: f.priority,
    };
    try {
      if (editing) await api(`/technician/tasks/${task.id}`, { method: 'PUT', body });
      else await api('/technician/tasks', { method: 'POST', body });
      toast(editing ? 'Task updated' : 'Task created', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit task' : 'New task'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <label className="field field-full">
          <span>Title <em>{f.title.length}/60</em></span>
          <input value={f.title} maxLength={60} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Washer not draining" autoFocus />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={f.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Machine</span>
          <select value={f.machine_id} onChange={(e) => pickMachine(e.target.value)}>
            <option value="">No machine</option>
            {machines.map((m) => <option key={m.device_id} value={m.device_id}>{m.friendly_name || m.device_id}{m.location ? ` — ${m.location}` : ''}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Technician</span>
          <select value={f.technician_id} onChange={(e) => set('technician_id', e.target.value)}>
            <option value="">Unassigned</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={f.scheduled_date} onChange={(e) => set('scheduled_date', e.target.value)} />
        </label>
        <label className="field">
          <span>Time</span>
          <input value={f.scheduled_time} onChange={(e) => set('scheduled_time', e.target.value)} placeholder="e.g. 11:00 AM" />
        </label>
        <label className="field field-full">
          <span>Location</span>
          <input value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Where the technician should go" />
        </label>
        <label className="field field-full">
          <span>Details</span>
          <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="What needs doing" />
        </label>
        {error ? <div className="form-error field-full">{error}</div> : null}
        <div className="form-actions field-full">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create task'}</button>
        </div>
      </form>
    </Modal>
  );
}
