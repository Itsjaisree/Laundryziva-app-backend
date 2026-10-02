const { run, get, all } = require('../config/db');
const { notifyUsers, ownerUserIds, supportUserIds } = require('./pushService');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const REMINDER_LEAD_MS = 60 * 60 * 1000;
const OFFLINE_AFTER_MS = 10 * 60 * 1000;
const SUMMARY_HOUR_IST = 20;

// "2026-10-03" + "11:00 AM" (or "14:30") in India time -> UTC milliseconds, or null if it can't be read.
const taskStartMs = (date, time) => {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const t = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(time || '');
  if (!d || !t) return null;
  let hour = Number(t[1]);
  const minute = Number(t[2]);
  if (t[3]) {
    const pm = t[3].toLowerCase() === 'pm';
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (pm ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hour, minute) - IST_OFFSET_MS;
};

const istDateKey = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

// One hour before the scheduled start: remind the technician. Only for tasks that already existed an hour ahead,
// so a task created at 10:30 for 11:00 doesn't get an assignment alert and a reminder together.
const sendTaskReminders = async () => {
  const now = Date.now();
  const today = istDateKey(now);
  const tomorrow = istDateKey(now + 24 * 60 * 60 * 1000);
  const tasks = await all(
    `SELECT id, org_id, title, location, technician_id, scheduled_date, scheduled_time, created_at
       FROM technician_tasks
      WHERE technician_id IS NOT NULL AND status IN ('Assigned', 'Scheduled')
        AND COALESCE(reminder_sent, 0) = 0 AND scheduled_date IN (?, ?)`,
    [today, tomorrow]
  );
  for (const t of tasks) {
    const start = taskStartMs(t.scheduled_date, t.scheduled_time);
    if (start == null || now >= start || now < start - REMINDER_LEAD_MS) continue;
    await run(`UPDATE technician_tasks SET reminder_sent = 1 WHERE id = ?`, [t.id]);
    if (Date.parse(t.created_at) > start - REMINDER_LEAD_MS) continue;
    await notifyUsers([t.technician_id], {
      title: 'Task starts in 1 hour',
      body: [t.title, t.location].filter(Boolean).join(' at '),
      data: { type: 'task', taskId: t.id },
      orgId: t.org_id,
      icon: 'alarm-outline',
    });
  }
};

// A machine silent for 10 minutes: tell its owner and support once. Re-armed when it comes back online.
const alertOfflineMachines = async () => {
  await run(`UPDATE machines SET offline_alerted = 0 WHERE health_status <> 'OFFLINE' AND COALESCE(offline_alerted, 0) = 1`);
  const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS).toISOString();
  const machines = await all(
    `SELECT device_id, friendly_name, location, org_id FROM machines
      WHERE health_status = 'OFFLINE' AND last_seen_at IS NOT NULL AND last_seen_at < ? AND COALESCE(offline_alerted, 0) = 0`,
    [cutoff]
  );
  if (!machines.length) return;
  const support = await supportUserIds();
  for (const m of machines) {
    await run(`UPDATE machines SET offline_alerted = 1 WHERE device_id = ?`, [m.device_id]);
    const owners = await ownerUserIds(m.org_id);
    const name = m.friendly_name || m.device_id;
    const body = `${name}${m.location ? ` at ${m.location}` : ''} has been offline for 10 min`;
    await notifyUsers(owners, { title: 'Machine offline', body, data: { type: 'machine', deviceId: m.device_id }, orgId: m.org_id, type: 'machine', icon: 'cloud-offline-outline', prefKey: 'machine_offline' });
    await notifyUsers(support, { title: 'Machine offline', body, data: { type: 'machine', deviceId: m.device_id }, orgId: m.org_id, type: 'machine', icon: 'cloud-offline-outline' });
  }
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// 8 PM India time, once a day: washes and revenue per organization, split by location.
const sendDailySummaries = async () => {
  const now = Date.now();
  if (new Date(now + IST_OFFSET_MS).getUTCHours() < SUMMARY_HOUR_IST) return;
  const day = istDateKey(now);
  const key = `daily_summary:${day}`;
  if (await get(`SELECT 1 AS x FROM scheduler_runs WHERE job_key = ?`, [key])) return;
  await run(`INSERT INTO scheduler_runs (job_key, ran_at) VALUES (?, ?) ON CONFLICT (job_key) DO NOTHING`, [key, new Date().toISOString()]);

  const fromIso = new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS).toISOString();
  const toIso = new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS + 24 * 60 * 60 * 1000).toISOString();

  const orgs = await all(`SELECT org_id, COUNT(*) AS total, SUM(CASE WHEN health_status = 'ONLINE' THEN 1 ELSE 0 END) AS online FROM machines WHERE org_id IS NOT NULL GROUP BY org_id`);
  for (const org of orgs) {
    const owners = await ownerUserIds(org.org_id);
    if (!owners.length) continue;
    const byLocation = await all(
      `SELECT COALESCE(m.location, 'Unknown location') AS location, COUNT(*) AS washes, COALESCE(SUM(t.amount), 0) AS revenue
         FROM transactions t LEFT JOIN machines m ON m.device_id = t.device_id
        WHERE t.org_id = ? AND t.status = 'SUCCESS' AND t.created_at >= ? AND t.created_at < ?
        GROUP BY COALESCE(m.location, 'Unknown location') ORDER BY revenue DESC`,
      [org.org_id, fromIso, toIso]
    );
    const washes = byLocation.reduce((s, r) => s + Number(r.washes), 0);
    const revenue = byLocation.reduce((s, r) => s + Number(r.revenue), 0);
    const lines = [`${washes} wash${washes === 1 ? '' : 'es'} · ${money(revenue)} · ${Number(org.online)} of ${Number(org.total)} machines online`];
    if (byLocation.length > 1) {
      byLocation.forEach((r) => lines.push(`${r.location}: ${r.washes} · ${money(r.revenue)}`));
    }
    await notifyUsers(owners, { title: "Today's summary", body: lines.join('\n'), data: { type: 'summary' }, orgId: org.org_id, type: 'summary', icon: 'stats-chart-outline', prefKey: 'daily_summary' });
  }
};

const safely = (name, fn) => fn().catch((err) => console.warn(`scheduler ${name} failed:`, err.message));

const startScheduler = () => {
  const tick = () => {
    safely('reminders', sendTaskReminders);
    safely('offline', alertOfflineMachines);
    safely('summary', sendDailySummaries);
  };
  setInterval(tick, 60 * 1000);
  setTimeout(tick, 20 * 1000);
};

module.exports = { startScheduler, taskStartMs, sendDailySummaries };
