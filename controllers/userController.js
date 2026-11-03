const bcrypt = require('bcryptjs');
const { run, get, all } = require('../config/db');
const {
  removeViewerMachineAssignments,
  setViewerMachineAssignments,
  getViewerAssignedMachines,
} = require('../services/viewerMachineService');

const COMPANY_WIDE_ROLE_KEYS = ['field_operations', 'support_refund_agent'];

const getUsers = async (req, res) => {
  try {
    const requesterRole = req.user?.role_key;
    // super_admin's own org_id is a seed placeholder, so only scope them when they ask to.
    const orgId = requesterRole === 'super_admin' ? req.query.org_id : (req.query.org_id || req.user?.org_id);
    const isPrivileged = requesterRole === 'super_admin' || requesterRole === 'organization_owner';
    // Non-privileged roles (e.g. support_refund_agent picking a technician for a task) may only ever list technicians.
    const role_key = isPrivileged ? req.query.role_key : 'field_operations';
    let sql = `SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active, created_at, last_login FROM users WHERE 1=1`;
    const params = [];

    const exactOrg = req.query.exact_org === 'true';
    if (orgId) {
      if (requesterRole === 'organization_owner' || exactOrg) {
        // An owner or exact_org query sees only users assigned to this organization.
        sql += ` AND org_id = ?`;
      } else {
        // Other callers still need the company-wide technicians.
        sql += ` AND (org_id = ? OR org_id IS NULL)`;
      }
      params.push(orgId);
    }
    if (role_key) {
      sql += ` AND role_key = ?`;
      params.push(role_key);
    }
    // super_admin's org_id is only a seed placeholder (the role is global-scope, not tied
    // to any one org) — never show it in an org's own user list.
    if (requesterRole !== 'super_admin') {
      sql += ` AND role_key != 'super_admin'`;
    }

    sql += ` ORDER BY created_at DESC`;

    const users = await all(sql, params);

    // Attach assigned machine IDs for viewer users
    try {
      const viewerRows = await all(`SELECT user_id, device_id FROM viewer_machine_assignments`);
      const map = {};
      for (const row of viewerRows) {
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(row.device_id);
      }
      for (const u of users) {
        u.assigned_machine_ids = map[u.id] || [];
      }
    } catch (e) {
      // ignore if table not yet initialized
    }

    return res.json({ users });
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role_id } = req.body;

    const missing = ['name', 'email', 'password', 'role_id'].filter((f) => !(req.body[f] || '').toString().trim());
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // role_key / role_name always come from the roles table, never from the client —
    // otherwise a technician could be saved with an owner's role_key.
    const role = await get(`SELECT id, role_key, name FROM roles WHERE id = ?`, [role_id]);
    if (!role) {
      return res.status(400).json({ error: 'Unknown role' });
    }
    if (role.role_key === 'super_admin') {
      return res.status(403).json({ error: 'Super admin accounts cannot be created here' });
    }

    // Technicians and customer support are company-wide, not owned by any one organization
    // (org_id stays NULL). Only organization owners belong to exactly one organization.
    let userOrgId = null;
    if (!COMPANY_WIDE_ROLE_KEYS.includes(role.role_key)) {
      const requestedOrgId = (req.body.org_id || '').toString().trim();
      if (!requestedOrgId) {
        return res.status(400).json({ error: 'Missing required field(s): org_id' });
      }
      const org = await get(`SELECT id FROM organizations WHERE id = ?`, [requestedOrgId]);
      if (!org) {
        return res.status(400).json({ error: 'Unknown organization' });
      }
      userOrgId = org.id;
    }

    const existingUser = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const userId = `USR_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    const passHash = await bcrypt.hash(password, 10);

    await run(`
      INSERT INTO users (id, name, email, phone, password_hash, role_id, role_key, role_name, org_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
    `, [userId, name.trim(), email.trim(), (phone || '').trim(), passHash, role.id, role.role_key, role.name, userOrgId, new Date().toISOString()]);

    const createdUser = await get(`SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active, created_at FROM users WHERE id = ?`, [userId]);

    if (Array.isArray(req.body.machine_ids) && req.body.machine_ids.length > 0 && userOrgId) {
      try {
        await setViewerMachineAssignments(userId, userOrgId, req.body.machine_ids);
      } catch (err) {
        console.warn('Failed to assign initial viewer machines:', err);
      }
    }

    return res.status(201).json({
      message: 'User created successfully',
      user_id: userId,
      user: createdUser,
    });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, password, phone, is_active, org_id, role_id, machine_ids } = req.body;

    const user = await get(`SELECT id, org_id, role_key FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name !== undefined) {
      await run(`UPDATE users SET name = ? WHERE id = ?`, [name, id]);
    }
    if (phone !== undefined) {
      await run(`UPDATE users SET phone = ? WHERE id = ?`, [phone, id]);
    }
    if (is_active !== undefined) {
      await run(`UPDATE users SET is_active = ? WHERE id = ?`, [is_active ? 1 : 0, id]);
    }
    if (password) {
      const passHash = await bcrypt.hash(password, 10);
      await run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passHash, id]);
    }

    let currentOrgId = user.org_id;
    if (org_id !== undefined) {
      if (org_id === null || org_id === '' || org_id === 'null') {
        await run(`UPDATE users SET org_id = NULL WHERE id = ?`, [id]);
        await removeViewerMachineAssignments(id);
        currentOrgId = null;
      } else {
        const org = await get(`SELECT id FROM organizations WHERE id = ?`, [org_id]);
        if (!org) {
          return res.status(400).json({ error: 'Unknown organization' });
        }
        await run(`UPDATE users SET org_id = ? WHERE id = ?`, [org.id, id]);
        currentOrgId = org.id;
      }
    }

    if (role_id !== undefined) {
      if (role_id) {
        const role = await get(`SELECT id, role_key, name FROM roles WHERE id = ?`, [role_id]);
        if (!role) {
          return res.status(400).json({ error: 'Unknown role' });
        }
        if (role.role_key === 'super_admin') {
          return res.status(403).json({ error: 'Cannot assign super admin role' });
        }
        await run(`UPDATE users SET role_id = ?, role_key = ?, role_name = ? WHERE id = ?`, [role.id, role.role_key, role.name, id]);
      }
    }

    if (machine_ids !== undefined) {
      if (currentOrgId) {
        await setViewerMachineAssignments(id, currentOrgId, machine_ids || []);
      } else {
        await removeViewerMachineAssignments(id);
      }
    }

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update user' });
  }
};

const getUserMachines = async (req, res) => {
  try {
    const { id } = req.params;
    const machines = await getViewerAssignedMachines(id);
    const deviceIds = machines.map((m) => m.device_id);
    return res.json({ machines, device_ids: deviceIds });
  } catch (err) {
    console.error('getUserMachines error:', err);
    return res.status(500).json({ error: 'Failed to fetch user machines' });
  }
};

const setUserMachines = async (req, res) => {
  try {
    const { id } = req.params;
    const { machine_ids } = req.body;
    const user = await get('SELECT id, org_id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.org_id) {
      return res.status(400).json({ error: 'User does not belong to an organization' });
    }
    const assigned = await setViewerMachineAssignments(id, user.org_id, machine_ids || []);
    return res.json({ message: 'Machine assignments updated successfully', machine_ids: assigned });
  } catch (err) {
    console.error('setUserMachines error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update machine assignments' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await get(`SELECT id FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await removeViewerMachineAssignments(id);
    await run(`DELETE FROM users WHERE id = ?`, [id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserMachines,
  setUserMachines,
};
