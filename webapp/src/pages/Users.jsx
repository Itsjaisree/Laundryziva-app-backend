import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Empty, Modal } from '../components/ui.jsx';
import { useToast } from '../toast.jsx';
import { formatWhen } from '../util.js';

// The fixed roles the super admin manages. Technicians and support belong to the company, owners to one organization.
const ROLES = [
  { id: 'ROLE_FIELD_OPERATIONS', key: 'field_operations', label: 'Technicians', one: 'technician', companyWide: true },
  { id: 'ROLE_SUPPORT_REFUND_AGENT', key: 'support_refund_agent', label: 'Customer support', one: 'support agent', companyWide: true },
  { id: 'ROLE_ORGANIZATION_OWNER', key: 'organization_owner', label: 'Organization owners', one: 'owner', companyWide: false },
];

export default function Users() {
  const [role, setRole] = useState(ROLES[0]);
  const [users, setUsers] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { user? } while open

  const load = useCallback(async () => {
    try {
      const [u, o] = await Promise.all([api('/users', { params: { role_key: role.key } }), api('/organizations')]);
      setUsers(u.users || []);
      setOrgs(o.organizations || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [role.key]);
  useEffect(() => {
    setUsers(null);
    load();
  }, [load]);

  const orgName = (id) => orgs.find((o) => o.id === id)?.name || '—';

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>Users</h2><p className="muted">Fixed roles only — no custom roles.</p></div>
        <button className="btn btn-primary" onClick={() => setForm({})}>+ Add {role.one}</button>
      </div>
      <div className="chips">
        {ROLES.map((r) => (
          <button key={r.key} className={`chip${role.key === r.key ? ' chip-on' : ''}`} onClick={() => setRole(r)}>{r.label}</button>
        ))}
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {users === null ? <Empty text="Loading…" /> : users.length === 0 ? <Empty text={`No ${role.label.toLowerCase()} yet.`} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th>{role.companyWide ? null : <th>Organization</th>}<th>Status</th><th>Last login</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  {role.companyWide ? null : <td>{orgName(u.org_id)}</td>}
                  <td>{u.is_active === 1 ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</td>
                  <td className="nowrap">{u.last_login ? formatWhen(u.last_login) : 'Never'}</td>
                  <td><button className="btn btn-sm" onClick={() => setForm({ user: u })}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form ? <UserForm role={role} orgs={orgs} user={form.user} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} /> : null}
    </div>
  );
}

function UserForm({ role, orgs, user, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!user;
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', password: '', org_id: user?.org_id || '', is_active: user ? user.is_active === 1 : true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editing && f.password.length < 6) return setError('Password must be at least 6 characters');
    if (editing && f.password && f.password.length < 6) return setError('New password must be at least 6 characters');
    if (!editing && !role.companyWide && !f.org_id) return setError('Choose the organization this owner belongs to');
    setBusy(true);
    try {
      if (editing) {
        const body = { name: f.name.trim(), phone: f.phone.trim(), is_active: f.is_active };
        if (f.password) body.password = f.password;
        await api(`/users/${user.id}`, { method: 'PUT', body });
      } else {
        await api('/users', {
          method: 'POST',
          body: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password, role_id: role.id, ...(role.companyWide ? {} : { org_id: f.org_id }) },
        });
      }
      toast(editing ? 'Saved' : `Added ${f.name.trim()}`, 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${user.name}` : `Add ${role.one}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field field-full"><span>Name</span><input value={f.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></label>
        <label className="field field-full"><span>Email</span><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required disabled={editing} /></label>
        <label className="field field-full"><span>Phone</span><input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        {!editing && !role.companyWide ? (
          <label className="field field-full">
            <span>Organization</span>
            <select value={f.org_id} onChange={(e) => set('org_id', e.target.value)} required>
              <option value="">Choose…</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="field field-full"><span>{editing ? 'New password (leave blank to keep)' : 'Password'}</span><input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" /></label>
        {editing ? (
          <label className="check field-full"><input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Account is active</label>
        ) : null}
        {error ? <div className="form-error field-full">{error}</div> : null}
        <div className="form-actions field-full">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
