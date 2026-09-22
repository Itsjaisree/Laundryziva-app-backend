const bcrypt = require('bcryptjs');
const { run, get, all } = require('../config/db');

const getUsers = async (req, res) => {
  try {
    const orgId = req.query.org_id || req.user?.org_id;
    let sql = `SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active, created_at, last_login FROM users`;
    const params = [];

    if (orgId) {
      sql += ` WHERE org_id = ? OR org_id IS NULL`;
      params.push(orgId);
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
    const { name, email, phone, password, role_id, role_key, role_name, org_id } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingUser = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const userId = `USR_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 1000)}`;
    const passToHash = password || 'User@123';
    const passHash = await bcrypt.hash(passToHash, 10);

    const userRoleKey = role_key || 'organization_owner';
    const userRoleName = role_name || 'Organization Owner';
    const userRoleId = role_id || 'ROLE_ORGANIZATION_OWNER';
    const userOrgId = org_id || req.user?.org_id || 'ORG_1637D16F';

    await run(`
      INSERT INTO users (id, name, email, phone, password_hash, role_id, role_key, role_name, org_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
    `, [userId, name || 'New User', email.trim(), phone || '', passHash, userRoleId, userRoleKey, userRoleName, userOrgId, new Date().toISOString()]);

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
