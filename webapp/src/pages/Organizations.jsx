import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Empty, Modal } from '../components/ui.jsx';
import { useToast } from '../toast.jsx';
import { formatWhen } from '../util.js';

export default function Organizations() {
  const toast = useToast();
  const [orgs, setOrgs] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('/organizations');
      setOrgs(d.organizations || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>Organizations</h2><p className="muted">Create the organization first, then add its owner under Users.</p></div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ New organization</button>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {orgs === null ? <Empty text="Loading…" /> : orgs.length === 0 ? <Empty text="No organizations yet." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>City</th><th>Contact</th><th>Phone</th><th>Created</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.name}</b><div className="muted small mono">{o.id}</div></td>
                  <td>{o.city}</td>
                  <td>{o.contact_name}<div className="muted small">{o.contact_email}</div></td>
                  <td>{o.contact_phone}</td>
                  <td className="nowrap">{formatWhen(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding ? <OrgForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); toast('Organization created', 'success'); load(); }} /> : null}
    </div>
  );
}

function OrgForm({ onClose, onSaved }) {
  const [f, setF] = useState({ name: '', city: '', contact_name: '', contact_email: '', contact_phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/organizations', { method: 'POST', body: f });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="New organization" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {[['name', 'Name'], ['city', 'City'], ['contact_name', 'Contact person'], ['contact_email', 'Contact email'], ['contact_phone', 'Contact phone']].map(([k, label]) => (
          <label key={k} className="field field-full">
            <span>{label}</span>
            <input value={f[k]} onChange={(e) => set(k, e.target.value)} required type={k === 'contact_email' ? 'email' : 'text'} />
          </label>
        ))}
        {error ? <div className="form-error field-full">{error}</div> : null}
        <div className="form-actions field-full">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}
