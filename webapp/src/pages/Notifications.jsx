import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty } from '../components/ui.jsx';
import { formatWhen } from '../util.js';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const data = await api('/notifications');
      setItems(data.notifications || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'PUT' }).catch(() => {});
    load();
  };
  const unread = (items || []).filter((n) => !n.is_read).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>Notifications</h2><p className="muted">{unread} unread</p></div>
        {unread ? <button className="btn" onClick={markAll}>Mark all read</button> : null}
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {items === null ? <Empty text="Loading…" /> : items.length === 0 ? <Empty text="You're all caught up." /> : (
        <div className="card list">
          {items.map((n) => (
            <div key={n.id} className={`list-row${n.is_read ? '' : ' list-unread'}`}>
              <div>
                <b>{n.title}</b>
                <div className="muted">{n.message}</div>
              </div>
              <span className="muted small nowrap">{formatWhen(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
