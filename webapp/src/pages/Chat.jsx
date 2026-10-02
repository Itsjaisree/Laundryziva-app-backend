import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatWhen } from '../util.js';
import { Empty, StatusBadge, usePolling } from '../components/ui.jsx';
import Thread from '../components/Thread.jsx';

// All technician conversations, newest first, with the open one beside the list.
export default function Chat() {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api('/chat/conversations');
      setList(data.conversations || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  usePolling(load, 10000, []);

  const current = list.find((c) => c.task_id === selected);

  return (
    <div className="page page-full">
      <div className="page-head"><h2>Messages</h2></div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="chat-layout">
        <div className="conv-list">
          {loading ? <Empty text="Loading…" /> : list.length === 0 ? <Empty text="No conversations yet." /> : list.map((c) => (
            <button key={c.task_id} className={`conv${selected === c.task_id ? ' conv-on' : ''}`} onClick={() => setSelected(c.task_id)}>
              <div className="conv-top">
                <b>{c.technician_name || 'Technician'}</b>
                <span className="muted small">{c.last_message_at ? formatWhen(c.last_message_at) : ''}</span>
              </div>
              <div className="conv-task">{c.title}{c.machine_label ? ` · ${c.machine_label}` : ''}</div>
              <div className={`conv-last${c.unread > 0 ? ' unread' : ''}`}>
                {c.last_message ? `${c.last_sender_role === 'support' ? 'You: ' : ''}${c.last_message}` : 'No messages yet'}
              </div>
              {c.unread > 0 ? <span className="unread-pill">{c.unread}</span> : null}
            </button>
          ))}
        </div>
        <div className="conv-thread">
          {current ? (
            <>
              <div className="thread-head">
                <div>
                  <b>{current.technician_name}</b>
                  <div className="muted small">{current.title}</div>
                </div>
                <div className="head-actions">
                  <StatusBadge status={current.status} />
                  <Link className="btn btn-sm" to={`/support/tasks/${current.task_id}`}>Open task</Link>
                </div>
              </div>
              <Thread key={current.task_id} taskId={current.task_id} onActivity={load} />
            </>
          ) : <Empty text="Choose a conversation." />}
        </div>
      </div>
    </div>
  );
}
