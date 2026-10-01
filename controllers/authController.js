const bcrypt = require('bcryptjs');
const { get, all, run } = require('../config/db');
const { generateToken } = require('../config/jwt');
const { revokeToken } = require('../services/tokenBlacklistService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const getMqttCredentialsForUser = async (user) => {
  if (user.role_key === 'super_admin' && process.env.PLATFORM_ADMIN_MQTT_PASSWORD) {
    return { username: 'platform_admin', password: process.env.PLATFORM_ADMIN_MQTT_PASSWORD };
  }
  if (user.org_id) {
    const org = await get(`SELECT mqtt_password FROM organizations WHERE id = ?`, [user.org_id]);
    if (org?.mqtt_password) {
      return { username: user.org_id, password: org.mqtt_password };
    }
  }
  return null;
};

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

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed login attempts. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        await run(`UPDATE users SET failed_login_attempts = 0, locked_until = ? WHERE id = ?`, [lockedUntil, user.id]);
        return res.status(423).json({ error: 'Account temporarily locked due to repeated failed login attempts. Try again later.' });
      }
      await run(`UPDATE users SET failed_login_attempts = ? WHERE id = ?`, [attempts, user.id]);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }

    await run(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`, [user.id]);

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

    const mqtt = await getMqttCredentialsForUser(user);

    return res.json({
      access_token,
      user: safeUser,
      mqtt,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

const logout = async (req, res) => {
  try {
    const payload = req.tokenPayload;
    if (payload?.jti && payload?.exp) {
      await revokeToken(payload.jti, payload.exp);
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
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

    const mqtt = await getMqttCredentialsForUser(user);

    return res.json({ user: safeUser, mqtt });
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
