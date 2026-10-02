const bcrypt = require('bcryptjs');
const { run, get, all } = require('../config/db');

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

    if (orgId) {
      sql += ` AND (org_id = ? OR org_id IS NULL)`;
      params.push(orgId);
    }
    if (role_key) {
      sql += ` AND role_key = ?`;
      params.push(role_key);
    }
    // super_admin's org_id is seeded to a real org (NOT NULL constraint), since the role
    // itself is global-scope rather than tied to any one org — never show it in an org's
    // own user list.
    if (requesterRole !== 'super_admin') {
      sql += ` AND role_key != 'super_admin'`;
    }

    sql += ` ORDER BY created_at DESC`;

    const users = await all(sql, params);
    return res.json({ users });
  } catch (err) {
    console.error('getUsers error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role_id, org_id } = req.body;

    const missing = ['name', 'email', 'password', 'role_id', 'org_id'].filter((f) => !(req.body[f] || '').toString().trim());
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

    const org = await get(`SELECT id FROM organizations WHERE id = ?`, [org_id]);
    if (!org) {
      return res.status(400).json({ error: 'Unknown organization' });
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
    `, [userId, name.trim(), email.trim(), (phone || '').trim(), passHash, role.id, role.role_key, role.name, org.id, new Date().toISOString()]);

    const createdUser = await get(`SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active, created_at FROM users WHERE id = ?`, [userId]);

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
    const { name, password, phone, is_active } = req.body;

    const user = await get(`SELECT id FROM users WHERE id = ?`, [id]);
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

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await get(`SELECT id FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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
};
