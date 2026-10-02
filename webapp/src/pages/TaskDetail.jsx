import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { formatWhen } from '../util.js';
import { Empty, ServerPhoto, StatusBadge } from '../components/ui.jsx';
import Thread from '../components/Thread.jsx';
import TaskForm from '../components/TaskForm.jsx';

const urlsOf = (listJson, single) => {
  let list = [];
  try {
    const parsed = typeof listJson === 'string' ? JSON.parse(listJson) : listJson;
    if (Array.isArray(parsed)) list = parsed.filter(Boolean);
  } catch (e) {
    // fall back to the single url
  }
  return list.length ? list : single ? [single] : [];
};

const Row = ({ label, children }) => (
  <div className="kv"><span>{label}</span><b>{children || '—'}</b></div>
);

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api(`/technician/tasks/${id}`);
      setTask(data.task);
      setPhotos(data.photos || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <div className="page"><div className="form-error">{error}</div><Link to="/support/work">← Back to work</Link></div>;
  if (!task) return <div className="page"><Empty text="Loading…" /></div>;

  const meta = (url) => {
    const p = photos.find((x) => x.id === url.split('/').pop());
    if (!p) return '';
    const coords = p.latitude != null ? `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}` : 'no GPS';
    return `${formatWhen(p.captured_at || p.created_at)} · ${coords}`;
  };
  const groups = [
    { label: 'Arrival', urls: urlsOf(task.before_photos, task.arrival_photo_url) },
    { label: 'Completion', urls: urlsOf(task.after_photos, task.verification_photo_url) },
  ].filter((g) => g.urls.length);

  return (
    <div className="page">
      <div className="crumbs"><Link to="/support/work">← Scheduled work</Link></div>
      <div className="page-head">
        <div>
          <h2>{task.title}</h2>
          <p className="muted">{[task.machine_label || task.machine_name, task.location].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="head-actions">
          <StatusBadge status={task.status} />
          {task.status !== 'Completed' ? <button className="btn" onClick={() => setEditing(true)}>Edit / reassign</button> : null}
        </div>
      </div>

      <div className="split">
        <div className="col">
          <div className="card">
            <h4>Details</h4>
            <div className="kv-grid">
              <Row label="Technician">{task.technician_name}</Row>
              <Row label="Scheduled">{[task.scheduled_date, task.scheduled_time].filter(Boolean).join('  ')}</Row>
              <Row label="Type">{task.type}</Row>
              <Row label="Priority">{task.priority}</Row>
              <Row label="Machine">{task.machine_label || task.machine_name}</Row>
              <Row label="Device ID"><code>{task.machine_id}</code></Row>
              <Row label="Created">{formatWhen(task.created_at)}</Row>
              <Row label="Updated">{formatWhen(task.updated_at)}</Row>
            </div>
            {task.description ? <p className="desc">{task.description}</p> : null}
          </div>

          {task.change_request_type ? (
            <div className="card card-amber">
              <h4>Change request ({task.change_request_status || 'Pending'})</h4>
              <p><b>{task.change_request_type}</b> — {task.change_request_reason}</p>
            </div>
          ) : null}

          <div className="card">
            <h4>Photos</h4>
            {groups.length === 0 ? <p className="muted">No photos yet. They appear when the technician arrives and when the work is done.</p> : groups.map((g) => (
              <div key={g.label} className="photo-group">
                <div className="photo-label">{g.label} ({g.urls.length})</div>
                <div className="photo-grid">
                  {g.urls.map((url) => (
                    <figure key={url}>
                      <ServerPhoto url={url} caption={g.label} />
                      <figcaption>{meta(url)}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col col-chat">
          <div className="card card-chat">
            <h4>Chat with {task.technician_name || 'technician'}</h4>
            {task.technician_id ? <Thread taskId={task.id} /> : <p className="muted">Assign a technician to start a conversation.</p>}
          </div>
        </div>
      </div>

      {editing ? <TaskForm task={task} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} /> : null}
    </div>
  );
}
