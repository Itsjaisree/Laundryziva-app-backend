const { run, get, all } = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    let sql = `SELECT * FROM notifications`;
    const params = [];

    if (userId) {
      sql += ` WHERE user_id = ? OR user_id IS NULL`;
      params.push(userId);
    }

    sql += ` ORDER BY created_at DESC`;
    const notifications = await all(sql, params);

    return res.json({ notifications });
  } catch (err) {
    console.error('getNotifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    const updated = await get(`SELECT * FROM notifications WHERE id = ?`, [id]);
    return res.json({ message: 'Notification marked as read', notification: updated });
  } catch (err) {
    console.error('markAsRead error:', err);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL`, [userId]);
    } else {
      await run(`UPDATE notifications SET is_read = 1`);
    }
    return res.json({ message: 'All notifications marked as read', is_read: 1 });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
