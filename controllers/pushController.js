const { isValidPushToken, saveToken, removeToken } = require('../services/pushService');

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

module.exports = { register, unregister };
