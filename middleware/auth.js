const { verifyToken } = require('../config/jwt');
const { get } = require('../config/db');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = verifyToken(token);
    const user = await get(`SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active FROM users WHERE id = ?`, [decoded.id]);

    if (!user || user.is_active !== 1) {
      return res.status(403).json({ error: 'User account inactive or not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    const user = await get(`SELECT id, name, email, phone, role_id, role_key, role_name, org_id, is_active FROM users WHERE id = ?`, [decoded.id]);
    if (user && user.is_active === 1) {
      req.user = user;
    }
  } catch (e) {
    // Ignore invalid optional tokens
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
};
