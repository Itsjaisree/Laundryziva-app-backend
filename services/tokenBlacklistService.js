const { run, get } = require('../config/db');

const revokeToken = async (jti, expUnixSeconds) => {
  if (!jti) return;
  const expiresAt = new Date(expUnixSeconds * 1000).toISOString();
  await run(`INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)`, [jti, expiresAt]);
  // Opportunistic cleanup of long-expired entries so the table doesn't grow forever.
  await run(`DELETE FROM revoked_tokens WHERE expires_at < ?`, [new Date().toISOString()]);
};

const isTokenRevoked = async (jti) => {
  if (!jti) return false;
  const row = await get(`SELECT jti FROM revoked_tokens WHERE jti = ?`, [jti]);
  return !!row;
};

module.exports = {
  revokeToken,
  isTokenRevoked,
};
