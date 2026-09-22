const bcrypt = require('bcryptjs');
const { get, all } = require('../config/db');
const { generateToken } = require('../config/jwt');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }

    const access_token = generateToken(user);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role_key,
      role_id: user.role_id,
      role_key: user.role_key,
      role_name: user.role_name,
      org_id: user.org_id,
    };

    return res.json({
      access_token,
      user: safeUser,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

const logout = async (req, res) => {
  return res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role_key,
      role_id: user.role_id,
      role_key: user.role_key,
      role_name: user.role_name,
      org_id: user.org_id,
    };

    return res.json({ user: safeUser });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getMyPermissions = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.role_id) {
      return res.json({ permissions: {} });
    }

    const perms = await all(`SELECT unit_key, mode, is_granted FROM permissions WHERE role_id = ?`, [user.role_id]);

    const permissionsMap = {};
    perms.forEach((p) => {
      if (p.is_granted || (p.mode && p.mode !== 'off')) {
        permissionsMap[p.unit_key] = p.mode || 'view';
      }
    });

    return res.json({ permissions: permissionsMap });
  } catch (err) {
    console.error('getMyPermissions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  getMyPermissions,
};
