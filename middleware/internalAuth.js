const crypto = require('crypto');

// Gates server-to-server calls from the device server (org list lookup, pairing a new
// machine) behind a shared secret — same pattern the device server uses for its own
// /api/gateway-callback and /api/device/states. Not a user session; no req.user is set.
const DEVICE_SERVER_INTEGRATION_KEY = process.env.DEVICE_SERVER_INTEGRATION_KEY || '';
if (!DEVICE_SERVER_INTEGRATION_KEY) {
  console.warn('DEVICE_SERVER_INTEGRATION_KEY is not set — /api/internal/* endpoints are disabled.');
}

const requireDeviceServerKey = (req, res, next) => {
  const suppliedKey = req.headers['x-internal-api-key'] || '';
  if (
    !DEVICE_SERVER_INTEGRATION_KEY ||
    suppliedKey.length !== DEVICE_SERVER_INTEGRATION_KEY.length ||
    !crypto.timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(DEVICE_SERVER_INTEGRATION_KEY))
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

module.exports = { requireDeviceServerKey };
