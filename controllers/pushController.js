const { run, all } = require('../config/db');
const { isValidPushToken, saveToken, removeToken } = require('../services/pushService');

// The only alert types a user may switch off. Everything else is always delivered.
const PREF_KEYS = ['payment_wash', 'machine_offline', 'daily_summary'];

// GET /api/push/prefs -> { payment_wash: true, machine_offline: true, daily_summary: true }
const getPrefs = async (req, res) => {
  try {
    const rows = await all(`SELECT pref_key, enabled FROM notification_prefs WHERE user_id = ?`, [req.user.id]);
    const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, true]));
    rows.forEach((r) => {
      if (k_ok(r.pref_key)) prefs[r.pref_key] = Number(r.enabled) === 1;
    });
    return res.json({ prefs });
  } catch (err) {
    console.error('getPrefs error:', err);
    return res.status(500).json({ error: 'Failed to load notification settings' });
  }
};
const k_ok = (k) => PREF_KEYS.includes(k);

// PUT /api/push/prefs { payment_wash?: bool, machine_offline?: bool, daily_summary?: bool }
const setPrefs = async (req, res) => {
  try {
    const entries = Object.entries(req.body || {}).filter(([k, v]) => k_ok(k) && typeof v === 'boolean');
    if (!entries.length) return res.status(400).json({ error: 'Nothing to update' });
    for (const [key, enabled] of entries) {
      await run(
        `INSERT INTO notification_prefs (user_id, pref_key, enabled) VALUES (?, ?, ?)
         ON CONFLICT (user_id, pref_key) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [req.user.id, key, enabled ? 1 : 0]
      );
    }
    return getPrefs(req, res);
  } catch (err) {
    console.error('setPrefs error:', err);
    return res.status(500).json({ error: 'Failed to save notification settings' });
  }
};

// POST /api/push/register { token, platform }
const register = async (req, res) => {
  const { token, platform } = req.body || {};
  if (!isValidPushToken(token)) {
    return res.status(400).json({ error: 'Invalid push token' });
  }
  try {
    await saveToken(req.user.id, token, ['android', 'ios'].includes(platform) ? platform : null);
    return res.json({ message: 'Registered' });
  } catch (err) {
    console.error('push register error:', err);
    return res.status(500).json({ error: 'Failed to register for notifications' });
  }
};

// POST /api/push/unregister { token } - called on logout so a shared phone stops getting the last user's alerts
const unregister = async (req, res) => {
  const { token } = req.body || {};
  if (!isValidPushToken(token)) {
    return res.status(400).json({ error: 'Invalid push token' });
  }
  try {
    await removeToken(req.user.id, token);
    return res.json({ message: 'Unregistered' });
  } catch (err) {
    console.error('push unregister error:', err);
    return res.status(500).json({ error: 'Failed to unregister' });
  }
};

module.exports = { register, unregister, getPrefs, setPrefs };
