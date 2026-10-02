import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty } from '../components/ui.jsx';
import { useToast } from '../toast.jsx';
import { formatWhen } from '../util.js';

const AUDIENCES = [
  { key: 'all', label: 'Everyone' },
  { key: 'owners', label: 'Owners' },
  { key: 'technicians', label: 'Technicians' },
  { key: 'support', label: 'Customer support' },
];

export default function Announcements() {
  const toast = useToast();
  const [audience, setAudience] = useState('all');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [count, setCount] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(() => api('/announcements').then((d) => setHistory(d.announcements || [])).catch(() => setHistory([])), []);
  useEffect(() => {
    loadHistory();
    api('/organizations').then((d) => setOrgs(d.organizations || [])).catch(() => {});
  }, [loadHistory]);

  useEffect(() => {
    setCount(null);
    api('/announcements/preview', { params: { audience, org_id: audience === 'owners' ? orgId : '' } }).then((d) => setCount(d.recipient_count)).catch(() => setCount(null));
  }, [audience, orgId]);

  const send = async (e) => {
    e.preventDefault();
    const where = AUDIENCES.find((a) => a.key === audience).label + (audience === 'owners' && orgId ? ` of ${orgs.find((o) => o.id === orgId)?.name}` : '');
    if (!window.confirm(`Send to ${count} ${count === 1 ? 'person' : 'people'} (${where})?\n\n"${title.trim()}"\n\nThis cannot be unsent.`)) return;
    setBusy(true);
    try {
      const d = await api('/announcements', { method: 'POST', body: { title: title.trim(), body: body.trim(), audience, org_id: audience === 'owners' && orgId ? orgId : undefined } });
      toast(`Sent to ${d.recipient_count}`, 'success');
      setTitle('');
      setBody('');
      loadHistory();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head"><div><h2>Announcements</h2><p className="muted">Goes to the phone as an alert and lands in each person's notification list.</p></div></div>
      <div className="split">
        <form className="card form" onSubmit={send}>
          <div className="field field-full">
            <span>Send to</span>
            <div className="chips">
              {AUDIENCES.map((a) => (
                <button type="button" key={a.key} className={`chip${audience === a.key ? ' chip-on' : ''}`} onClick={() => { setAudience(a.key); setOrgId(''); }}>{a.label}</button>
              ))}
            </div>
          </div>
          {audience === 'owners' && orgs.length ? (
            <label className="field field-full">
              <span>Organization</span>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">All organizations</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="reach field-full">{count == null ? 'Counting…' : count === 0 ? 'Nobody is in this group yet' : `Will reach ${count} ${count === 1 ? 'person' : 'people'}`}</div>
          <label className="field field-full"><span>Title <em>{title.length}/80</em></span><input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className="field field-full"><span>Message <em>{body.length}/500</em></span><textarea rows={5} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} required /></label>
          <div className="form-actions field-full"><button className="btn btn-primary" disabled={busy || !count || !title.trim() || !body.trim()}>{busy ? 'Sending…' : 'Send announcement'}</button></div>
        </form>
        <div className="card">
          <h4>Sent before</h4>
          {history === null ? <Empty text="Loading…" /> : history.length === 0 ? <Empty text="Nothing sent yet." /> : history.map((h) => (
            <div key={h.id} className="hist">
              <b>{h.title}</b>
              <div>{h.body}</div>
              <div className="muted small">{h.audience_label} · {h.recipient_count} {h.recipient_count === 1 ? 'person' : 'people'} · {formatWhen(h.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
