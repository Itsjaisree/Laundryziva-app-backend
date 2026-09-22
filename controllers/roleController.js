const { run, get, all } = require('../config/db');

const getRoles = async (req, res) => {
  try {
    const roles = await all(`
      SELECT r.*, COUNT(u.id) as user_count 
      FROM roles r 
      LEFT JOIN users u ON r.id = u.role_id 
      GROUP BY r.id 
      ORDER BY r.is_system_role DESC, r.name ASC
    `);

    const formattedRoles = roles.map((r) => ({
      id: r.id,
      name: r.display_name || r.name,
      display_name: r.display_name || r.name,
      description: r.description,
      user_count: r.user_count || 0,
      is_system_role: r.is_system_role,
      role_key: r.role_key,
      scope: r.scope,
      org_id: r.org_id,
    }));

    return res.json({ roles: formattedRoles });
  } catch (err) {
    console.error('getRoles error:', err);
    return res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

const createRole = async (req, res) => {
  try {
    const { display_name, description, permissions, scope, org_id } = req.body;

    if (!display_name) {
      return res.status(400).json({ error: 'Role display name is required' });
    }

    const roleKey = display_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const roleId = `ROLE_${Date.now()}`;
    const createdAt = new Date().toISOString();

    await run(`
      INSERT INTO roles (id, name, display_name, role_key, description, is_system_role, scope, org_id, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);
    `, [roleId, display_name, display_name, roleKey, description || '', scope || 'organization', org_id || req.user?.org_id || 'ORG_1637D16F', createdAt]);

    if (permissions && Array.isArray(permissions)) {
      for (const p of permissions) {
        await run(`
          INSERT INTO permissions (role_id, unit_key, mode, is_granted)
          VALUES (?, ?, ?, 1);
        `, [roleId, p.unit_key || p.key, p.mode || 'view']);
      }
    }

    const newRole = await get(`SELECT * FROM roles WHERE id = ?`, [roleId]);
    return res.status(201).json(newRole);
  } catch (err) {
    console.error('createRole error:', err);
    return res.status(500).json({ error: 'Failed to create role' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await get(`SELECT * FROM roles WHERE id = ?`, [id]);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.is_system_role) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    await run(`DELETE FROM roles WHERE id = ?`, [id]);
    return res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error('deleteRole error:', err);
    return res.status(500).json({ error: 'Failed to delete role' });
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const perms = await all(`SELECT unit_key, mode, is_granted FROM permissions WHERE role_id = ?`, [id]);

    const formatted = perms.map((p) => ({
      key: p.unit_key,
      unit_key: p.unit_key,
      granted_mode: p.mode,
      mode: p.mode,
      is_granted: p.is_granted === 1,
    }));

    return res.json({ permissions: formatted });
  } catch (err) {
    console.error('getRolePermissions error:', err);
    return res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
};

const updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.unit_key || body.key) {
      const unitKey = body.unit_key || body.key;
      const mode = body.mode || body.granted_mode || 'view';

      const existing = await get(`SELECT * FROM permissions WHERE role_id = ? AND unit_key = ?`, [id, unitKey]);
      if (existing) {
        await run(`UPDATE permissions SET mode = ?, is_granted = ? WHERE role_id = ? AND unit_key = ?`, [mode, mode !== 'off' ? 1 : 0, id, unitKey]);
      } else {
        await run(`INSERT INTO permissions (role_id, unit_key, mode, is_granted) VALUES (?, ?, ?, ?)`, [id, unitKey, mode, mode !== 'off' ? 1 : 0]);
      }
    } else if (typeof body === 'object' && body !== null) {
      for (const [key, mode] of Object.entries(body)) {
        const existing = await get(`SELECT * FROM permissions WHERE role_id = ? AND unit_key = ?`, [id, key]);
        if (existing) {
          await run(`UPDATE permissions SET mode = ?, is_granted = ? WHERE role_id = ? AND unit_key = ?`, [mode, mode !== 'off' ? 1 : 0, id, key]);
        } else {
          await run(`INSERT INTO permissions (role_id, unit_key, mode, is_granted) VALUES (?, ?, ?, ?)`, [id, key, mode, mode !== 'off' ? 1 : 0]);
        }
      }
    }

    return res.json({ message: 'Permissions updated successfully' });
  } catch (err) {
    console.error('updateRolePermissions error:', err);
    return res.status(500).json({ error: 'Failed to update role permissions' });
  }
};

const getRoleNotificationTypes = async (req, res) => {
  try {
    const { id } = req.params;
    const notifs = await all(`SELECT type_key, is_enabled FROM notification_types WHERE role_id = ?`, [id]);

    const formatted = notifs.map((n) => ({
      key: n.type_key,
      type_key: n.type_key,
      is_enabled: n.is_enabled === 1,
      enabled: n.is_enabled === 1,
    }));

    return res.json({ notification_types: formatted });
  } catch (err) {
    console.error('getRoleNotificationTypes error:', err);
    return res.status(500).json({ error: 'Failed to fetch notification types' });
  }
};

const updateRoleNotificationTypes = async (req, res) => {
  try {
    const { id } = req.params;
    const { notification_key, type_key, is_enabled, enabled } = req.body;

    const key = notification_key || type_key;
    const isEnabledVal = is_enabled !== undefined ? (is_enabled ? 1 : 0) : (enabled ? 1 : 0);

    if (key) {
      const existing = await get(`SELECT * FROM notification_types WHERE role_id = ? AND type_key = ?`, [id, key]);
      if (existing) {
        await run(`UPDATE notification_types SET is_enabled = ? WHERE role_id = ? AND type_key = ?`, [isEnabledVal, id, key]);
      } else {
        await run(`INSERT INTO notification_types (role_id, type_key, is_enabled) VALUES (?, ?, ?)`, [id, key, isEnabledVal]);
      }
    }

    return res.json({ message: 'Notification types updated successfully' });
  } catch (err) {
    console.error('updateRoleNotificationTypes error:', err);
    return res.status(500).json({ error: 'Failed to update notification types' });
  }
};

module.exports = {
  getRoles,
  createRole,
  deleteRole,
  getRolePermissions,
  updateRolePermissions,
  getRoleNotificationTypes,
  updateRoleNotificationTypes,
};
