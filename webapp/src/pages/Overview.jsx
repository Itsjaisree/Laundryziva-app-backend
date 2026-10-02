import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { MACHINE_STATUS, machineStatus } from '../util.js';

// Platform-wide numbers for the super admin.
export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/machines'), api('/organizations'), api('/users'), api('/technician/tasks', { params: { all: 'true' } })])
      .then(([m, o, u, t]) => setData({ machines: m.machines || [], orgs: o.organizations || [], users: u.users || [], tasks: t.tasks || [] }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page"><div className="empty">Loading…</div></div>;

  const counts = {};
  data.machines.forEach((m) => {
    const k = machineStatus(m).key;
    counts[k] = (counts[k] || 0) + 1;
  });
  const byRole = (k) => data.users.filter((u) => u.role_key === k && u.is_active === 1).length;
  const openTasks = data.tasks.filter((t) => t.status !== 'Completed').length;
  const review = data.tasks.filter((t) => t.status === 'Pending Approval').length;

  return (
    <div className="page">
      <div className="page-head"><h2>Overview</h2></div>
      <div className="cards-4">
        <div className="card kpi"><span>Organizations</span><b>{data.orgs.length}</b></div>
        <div className="card kpi"><span>Machines</span><b>{data.machines.length}</b></div>
        <div className="card kpi"><span>Open tasks</span><b>{openTasks}</b><small>{review} awaiting review</small></div>
        <div className="card kpi"><span>Active staff</span><b>{byRole('field_operations') + byRole('support_refund_agent')}</b><small>{byRole('field_operations')} technicians · {byRole('support_refund_agent')} support</small></div>
      </div>
      <div className="card">
        <h4>Machine status</h4>
        <div className="stat-row stat-row-flat">
          {Object.values(MACHINE_STATUS).map((st) => (
            <div key={st.key} className="stat stat-static"><span className="dot" style={{ background: st.color }} /><span className="stat-label">{st.label}</span><b style={{ color: st.color }}>{counts[st.key] || 0}</b></div>
          ))}
        </div>
        <Link to="/super/machines">View all machines →</Link>
      </div>
    </div>
  );
}
