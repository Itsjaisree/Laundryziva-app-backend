const { run, all } = require('../config/db');

/**
 * Creates persistent organization-isolated notifications for Organization Owners & Admins.
 *
 * @param {Object} params
 * @param {string} params.org_id - Target organization ID
 * @param {string} params.title - Title of the notification
 * @param {string} params.message - Detailed body text
 * @param {string} [params.type] - Category e.g., 'machine', 'maintenance', 'transaction', 'system'
 * @param {string} [params.category] - Level e.g., 'info', 'warning', 'error', 'success'
 * @param {string} [params.icon] - UI icon key
 */
const createNotification = async ({ org_id, title, message, type = 'info', category = 'info', icon = 'notifications-outline' }) => {
  try {
    const targetOrgId = org_id || 'ORG_1637D16F';

    // Find all Organization Owners (and Super Admins) for this organization
    const owners = await all(
      `SELECT id FROM users WHERE (org_id = ? OR org_id IS NULL) AND (role_key = 'organization_owner' OR role_key = 'super_admin' OR role_name LIKE '%Owner%' OR role_name LIKE '%Admin%')`,
      [targetOrgId]
    );

    const createdAt = new Date().toISOString();

    if (owners && owners.length > 0) {
      for (const owner of owners) {
        const notifId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await run(
          `INSERT INTO notifications (id, user_id, org_id, title, message, type, category, icon, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [notifId, owner.id, targetOrgId, title, message, type, category, icon, createdAt]
        );
      }
    } else {
      const notifId = `NOTIF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await run(
        `INSERT INTO notifications (id, user_id, org_id, title, message, type, category, icon, is_read, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [notifId, targetOrgId, title, message, type, category, icon, createdAt]
      );
    }
  } catch (err) {
    console.error('createNotification service error:', err);
  }
};

module.exports = {
  createNotification,
};
