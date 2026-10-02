import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatWhen } from '../util.js';
import { usePolling } from './ui.jsx';
import { useAuth } from '../auth.jsx';

// The chat between support and the technician for one task. New messages are fetched every few seconds.
export default function Thread({ taskId, onActivity }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const cursor = useRef(null);

  useEffect(() => {
    setMessages([]);
    cursor.current = null;
  }, [taskId]);

  const load = async () => {
    try {
      const data = await api(`/chat/tasks/${taskId}/messages`, { params: { after: cursor.current || undefined } });
      if (data.messages.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
          return merged.length === prev.length ? prev : merged;
        });
        cursor.current = data.messages[data.messages.length - 1].created_at;
      }
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  usePolling(load, 4000, [taskId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const data = await api(`/chat/tasks/${taskId}/messages`, { method: 'POST', body: { message: value } });
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      cursor.current = data.message.created_at;
      setText('');
      setError('');
      onActivity?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="thread">
      <div className="thread-body">
        {messages.length === 0 ? <div className="empty">No messages yet. Say hello to the technician.</div> : null}
        {messages.map((m) =>
          m.is_system || m.sender_role === 'system' ? (
            <div key={m.id} className="msg-system">{m.message}</div>
          ) : (
            <div key={m.id} className={`msg ${m.sender_id === user?.id ? 'msg-mine' : 'msg-theirs'}`}>
              {m.sender_id === user?.id ? null : <div className="msg-name">{m.sender_name}</div>}
              <div className="msg-text">{m.message}</div>
              <div className="msg-time">{formatWhen(m.created_at)}</div>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <form className="composer" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message…" />
        <button className="btn btn-primary" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
