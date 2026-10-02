const { run, all } = require('../config/db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/;
const CHUNK = 100;

const isValidPushToken = (token) => typeof token === 'string' && token.length < 200 && EXPO_TOKEN_RE.test(token);

// One row per device token. A token belongs to whoever logged in last on that device.
const saveToken = async (userId, token, platform) => {
  const now = new Date().toISOString();
  await run(
    `INSERT INTO push_tokens (token, user_id, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = EXCLUDED.updated_at`,
    [token, userId, platform || null, now, now]
  );
};

const removeToken = (userId, token) => run(`DELETE FROM push_tokens WHERE token = ? AND user_id = ?`, [token, userId]);

const sendToTokens = async (tokens, { title, body, data }) => {
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high', channelId: 'default' }))),
    });
    if (!res.ok) {
      console.warn('push send failed:', res.status);
      continue;
    }
    const { data: tickets = [] } = await res.json();
    // Tokens Expo says no longer exist (app uninstalled, token rotated) are dropped so we stop sending to them.
    const dead = batch.filter((_, idx) => tickets[idx]?.details?.error === 'DeviceNotRegistered');
    for (const token of dead) {
      await run(`DELETE FROM push_tokens WHERE token = ?`, [token]).catch(() => {});
    }
  }
};

/**
 * Tells these users something happened: an inbox row (so it is still there after the phone alert is gone)
 * plus a phone push. Never throws - a failed notification must not fail the action that triggered it.
 *
 * @param {string[]} userIds
 * @param {{title: string, body: string, data?: object, orgId?: string, type?: string, icon?: string}} n
 */
const notifyUsers = async (userIds, { title, body, data = {}, orgId = null, type = 'task', icon = 'notifications-outline', prefKey = null }) => {
  try {
    let ids = [...new Set((userIds || []).filter(Boolean))];
    // Owners can switch some types off (payments, offline, daily summary); everything else is always sent.
    if (prefKey && ids.length) {
      const off = await all(
        `SELECT user_id FROM notification_prefs WHERE pref_key = ? AND enabled = 0 AND user_id IN (${ids.map(() => '?').join(',')})`,
        [prefKey, ...ids]
      );
      const offSet = new Set(off.map((r) => r.user_id));
      ids = ids.filter((id) => !offSet.has(id));
    }
    if (ids.length === 0) return;
    const createdAt = new Date().toISOString();

    for (const userId of ids) {
      try {
        const notifId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await run(
          `INSERT INTO notifications (id, user_id, org_id, title, message, type, category, icon, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'info', ?, 0, ?)`,
          [notifId, userId, orgId, title, body, type, icon, createdAt]
        );
      } catch (e) {
        console.warn('inbox notification failed:', e.message);
      }
    }

    const placeholders = ids.map(() => '?').join(',');
    const rows = await all(`SELECT token FROM push_tokens WHERE user_id IN (${placeholders})`, ids);
    if (rows.length) await sendToTokens(rows.map((r) => r.token), { title, body, data });
  } catch (err) {
    console.warn('notifyUsers failed:', err.message);
  }
};

const ownerUserIds = async (orgId) =>
  orgId ? (await all(`SELECT id FROM users WHERE role_key = 'organization_owner' AND org_id = ? AND is_active = 1`, [orgId])).map((u) => u.id) : [];

const supportUserIds = async () =>
  (await all(`SELECT id FROM users WHERE role_key = 'support_refund_agent' AND is_active = 1`)).map((u) => u.id);

module.exports = { isValidPushToken, saveToken, removeToken, notifyUsers, supportUserIds, ownerUserIds };
