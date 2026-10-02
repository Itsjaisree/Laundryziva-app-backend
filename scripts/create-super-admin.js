// Creates (or resets the password of) a super_admin user. Credentials come from the
// environment so they never land in git or shell history files in plain script text.
//
// Usage: SA_EMAIL=you@example.com SA_PASSWORD='...' node scripts/create-super-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { run, get } = require('../config/db');

// users.org_id is NOT NULL, and super_admin is global-scope — same placeholder org the seed uses.
const PLACEHOLDER_ORG_ID = 'ORG_1637D16F';

const main = async () => {
  const email = (process.env.SA_EMAIL || '').trim();
  const password = process.env.SA_PASSWORD || '';
  if (!email || !password) {
    throw new Error('SA_EMAIL and SA_PASSWORD must both be set');
  }

  const passHash = await bcrypt.hash(password, 10);
  const existing = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email]);

  if (existing) {
    await run(
      `UPDATE users SET password_hash = ?, role_id = 'ROLE_SUPER_ADMIN', role_key = 'super_admin', role_name = 'Super Admin', is_active = 1, failed_login_attempts = 0, locked_until = NULL WHERE id = ?`,
      [passHash, existing.id]
    );
    console.log(`Updated existing user ${email} to super_admin with the new password.`);
    return;
  }

  const userId = `USR_${Date.now().toString(36).toUpperCase()}`;
  await run(
    `INSERT INTO users (id, name, email, phone, password_hash, role_id, role_key, role_name, org_id, is_active, created_at)
     VALUES (?, 'Super Admin', ?, '', ?, 'ROLE_SUPER_ADMIN', 'super_admin', 'Super Admin', ?, 1, ?)`,
    [userId, email, passHash, PLACEHOLDER_ORG_ID, new Date().toISOString()]
  );
  console.log(`Created super_admin ${email} (${userId}).`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('create-super-admin failed:', err.message);
    process.exit(1);
  });
