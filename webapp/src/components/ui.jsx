import React, { useEffect, useRef, useState } from 'react';
import { fetchPhotoBlobUrl } from '../api.js';
import { statusTone } from '../util.js';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Badge = ({ tone, children }) => <span className={`badge badge-${tone || 'slate'}`}>{children}</span>;
export const StatusBadge = ({ status }) => <Badge tone={statusTone(status)}>{status}</Badge>;

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

// A task photo, loaded with the login token. Click to see it full size.
export function ServerPhoto({ url, caption }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    setSrc(null);
    setFailed(false);
    fetchPhotoBlobUrl(url)
      .then((u) => {
        objectUrl = u;
        if (alive) setSrc(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  if (failed) return <div className="photo photo-missing">Could not load photo</div>;
  if (!src) return <div className="photo photo-loading">Loading…</div>;
  return (
    <>
      <img className="photo" src={src} alt={caption || 'Task photo'} onClick={() => setOpen(true)} />
      {open ? (
        <div className="lightbox" onClick={() => setOpen(false)}>
          <img src={src} alt={caption || 'Task photo'} />
        </div>
      ) : null}
    </>
  );
}

// Polls a loader while the tab is visible
export function usePolling(fn, ms, deps = []) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    let stopped = false;
    const tick = () => {
      if (!stopped && document.visibilityState === 'visible') saved.current();
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
