const { run, get, all } = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userOrgId = req.user?.org_id;
    let sql = `SELECT * FROM notifications`;
    const params = [];

    const conditions = [];
    if (userId) {
      conditions.push(`(user_id = ? OR user_id IS NULL)`);
      params.push(userId);
    }
    if (userOrgId) {
      conditions.push(`(org_id = ? OR org_id IS NULL)`);
      params.push(userOrgId);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
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
    const userId = req.user?.id;
    const userOrgId = req.user?.org_id;

    const notif = await get(`SELECT * FROM notifications WHERE id = ?`, [id]);
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (userId && notif.user_id && notif.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Cannot update notification belonging to another user' });
    }
    if (userOrgId && notif.org_id && notif.org_id !== userOrgId) {
      return res.status(403).json({ error: 'Forbidden: Cannot update notification belonging to another organization' });
    }

    await run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
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
    const userOrgId = req.user?.org_id;
    if (userId) {
      await run(`UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id IS NULL) AND (org_id = ? OR org_id IS NULL)`, [userId, userOrgId]);
    } else {
      await run(`UPDATE notifications SET is_read = 1`);
    }
    return res.json({ message: 'All notifications marked as read', is_read: 1 });
  } catch (err) {
    console.error('markAllAsRead error:', err);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};

const createSystemAlert = async (req, res) => {
  try {
    const { createNotification } = require('../services/notificationService');
    const { title, message, category, org_id } = req.body;
    const targetOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';

    await createNotification({
      org_id: targetOrgId,
      title: title || 'Organization System Alert',
      message: message || 'System maintenance scheduled for tonight at 02:00 AM UTC.',
      type: 'system',
      category: category || 'warning',
      icon: 'alert-circle-outline'
    });

    return res.status(201).json({ success: true, message: 'System alert notification created' });
  } catch (err) {
    console.error('createSystemAlert error:', err);
    return res.status(500).json({ error: 'Failed to create system alert' });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createSystemAlert,
};
