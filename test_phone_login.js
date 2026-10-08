// Run with: JWT_SECRET=x FIREBASE_PROJECT_ID=demo node --test test_phone_login.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-project';

// A fake database: users in memory, and the one query phone login runs is answered by matching the last 10 digits.
let users = [];
const dbPath = path.resolve(__dirname, 'config/db.js');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    run: async () => ({ changes: 1, rows: [] }),
    get: async () => undefined,
    all: async (sql, params) => users.filter((u) => String(u.phone || '').replace(/\D/g, '').slice(-10) === params[0]),
  },
};

const phoneAuth = require('./services/phoneAuthService');
const { phoneLogin } = require('./controllers/authController');

const call = async (body, verified) => {
  phoneAuth.verifyPhoneToken = async () => {
    if (verified instanceof Error) throw verified;
    return verified;
  };
  let out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; out.status = out.status || 200; return this; } };
  await phoneLogin({ body }, res);
  return out;
};
const user = (over = {}) => ({ id: 'U1', name: 'Asha', email: 'a@x.com', phone: '98765 43210', role_id: 'R', role_key: 'field_operations', role_name: 'Field Operations', org_id: null, is_active: 1, ...over });

test('lastTenDigits ignores spaces, plus and country code', () => {
  assert.strictEqual(phoneAuth.lastTenDigits('+91 98765-43210'), '9876543210');
  assert.strictEqual(phoneAuth.lastTenDigits('9876543210'), '9876543210');
});

test('missing token is a 400', async () => {
  assert.strictEqual((await call({}, '+919876543210')).status, 400);
});

test('a token Firebase rejects is a 401', async () => {
  assert.strictEqual((await call({ id_token: 'x' }, new Error('bad'))).status, 401);
});

test('a verified number with no account is a 401', async () => {
  users = [];
  const r = await call({ id_token: 'x' }, '+919876543210');
  assert.strictEqual(r.status, 401);
  assert.match(r.body.error, /No account/);
});

test('a verified number signs the matching user in', async () => {
  users = [user()];
  const r = await call({ id_token: 'x' }, '+919876543210');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.access_token);
  assert.strictEqual(r.body.user.id, 'U1');
});

test('two accounts with the same number is a 409', async () => {
  users = [user(), user({ id: 'U2', email: 'b@x.com', phone: '+91 9876543210' })];
  assert.strictEqual((await call({ id_token: 'x' }, '+919876543210')).status, 409);
});

test('a deactivated or locked account is refused', async () => {
  users = [user({ is_active: 0 })];
  assert.strictEqual((await call({ id_token: 'x' }, '+919876543210')).status, 403);
  users = [user({ locked_until: new Date(Date.now() + 60000).toISOString() })];
  assert.strictEqual((await call({ id_token: 'x' }, '+919876543210')).status, 423);
});
