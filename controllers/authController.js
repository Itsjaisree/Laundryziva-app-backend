const bcrypt = require('bcryptjs');
const { get, all, run } = require('../config/db');
const { generateToken } = require('../config/jwt');
const { revokeToken } = require('../services/tokenBlacklistService');
const phoneAuth = require('../services/phoneAuthService');

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

// Everything that happens after a person has proved who they are (password or phone): clear the lock counters,
// sign the token and build the answer the app expects.
const completeLogin = async (user) => {
  await run(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?`, [new Date().toISOString(), user.id]);
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
  return { access_token, user: safeUser, mqtt };
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

    return res.json(await completeLogin(user));
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

// POST /api/auth/phone-login { id_token }
// The app has already verified the phone with Firebase (SMS code). We check Firebase's signed token, find the staff
// account whose phone number matches, and sign it in exactly as a password login would.
const phoneLogin = async (req, res) => {
  try {
    if (!phoneAuth.isEnabled()) {
      return res.status(503).json({ error: 'Phone sign-in is not configured' });
    }
    const idToken = (req.body?.id_token || '').toString();
    if (!idToken) {
      return res.status(400).json({ error: 'id_token is required' });
    }

    let phone;
    try {
      phone = await phoneAuth.verifyPhoneToken(idToken);
    } catch (e) {
      // The reason stays in the log (never the token); the user gets a plain message
      console.warn('phoneLogin: token check failed:', e.code || '', String(e.message || e).slice(0, 160));
      return res.status(401).json({ error: 'Phone verification failed. Please try again.' });
    }

    const tail = phoneAuth.lastTenDigits(phone);
    if (tail.length < 10) {
      return res.status(401).json({ error: 'Phone verification failed. Please try again.' });
    }
    const matches = await all(
      `SELECT * FROM users WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = ?`,
      [tail]
    );
    if (matches.length === 0) {
      return res.status(401).json({ error: 'No account uses this phone number. Ask your administrator to add it to your profile.' });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'This phone number belongs to more than one account. Ask your administrator to fix it.' });
    }
    const user = matches[0];
    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'User account is deactivated' });
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Account temporarily locked due to repeated failed login attempts. Try again later.' });
    }
    return res.json(await completeLogin(user));
  } catch (err) {
    console.error('phoneLogin error:', err);
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
  completeLogin,
  login,
  phoneLogin,
  logout,
  getMe,
  getMyPermissions,
};
