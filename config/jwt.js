const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'laundryziva_super_secret_jwt_key_2026';
const JWT_EXPIRES_IN = '7d';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      org_id: user.org_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
};
