export const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const timeToMinutes = (t) => {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(t || '');
  if (!m) return 24 * 60;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  return h * 60 + Number(m[2]);
};

export const formatDay = (key) => parseKey(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const formatWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

// How a machine is described everywhere (same rules as the mobile app)
export const MACHINE_STATUS = {
  ONLINE: { key: 'ONLINE', label: 'Online', color: '#16a34a' },
  WAITING_LOAD: { key: 'WAITING_LOAD', label: 'Waiting for load', color: '#ca8a04' },
  WASHING: { key: 'WASHING', label: 'Washing', color: '#2563eb' },
  OFFLINE: { key: 'OFFLINE', label: 'Offline', color: '#dc2626' },
  MAINTENANCE: { key: 'MAINTENANCE', label: 'Maintenance', color: '#6b7280' },
};
export const machineStatus = (m) => {
  const state = String(m.state || '').toUpperCase();
  const health = String(m.health_status || '').toUpperCase();
  if (state === 'OFFLINE' || health === 'OFFLINE' || (!health && !state)) return MACHINE_STATUS.OFFLINE;
  if (['DISABLED', 'MAINTENANCE', 'FAULT'].includes(state) || ['ERROR', 'MAINTENANCE'].includes(health)) return MACHINE_STATUS.MAINTENANCE;
  if (state === 'WASHING' || state === 'RUNNING') return MACHINE_STATUS.WASHING;
  if (state === 'WAITING_LOAD') return MACHINE_STATUS.WAITING_LOAD;
  return MACHINE_STATUS.ONLINE;
};

export const TASK_STATUSES = ['Unassigned', 'Assigned', 'Scheduled', 'In Progress', 'Pending Approval', 'Completed'];
export const statusTone = (s) =>
  ({ Completed: 'green', 'In Progress': 'blue', 'Pending Approval': 'amber', Assigned: 'slate', Scheduled: 'slate', Unassigned: 'red' }[s] || 'slate');
