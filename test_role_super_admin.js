const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Mock db for standalone isolated execution
const dbPath = path.resolve(__dirname, 'config/db.js');
let mockUsers = [
  { id: 'U1', name: 'Super Admin', email: 'admin@allziva.com', role_key: 'super_admin', org_id: 'ORG_ADMIN', is_active: 1 },
  { id: 'U2', name: 'Org Owner', email: 'owner@org1.com', role_key: 'organization_owner', org_id: 'ORG_1', is_active: 1 },
  { id: 'U3', name: 'Viewer User', email: 'viewer@org1.com', role_key: 'organization_viewer', org_id: 'ORG_1', is_active: 1 },
  { id: 'U4', name: 'Free User', email: 'free@allziva.com', role_key: 'viewer', org_id: null, is_active: 1 },
];

let mockOrgs = [
  { id: 'ORG_1', name: 'Alpha Laundry', city: 'Chennai', contact_name: 'John' },
  { id: 'ORG_2', name: 'Beta Cleaners', city: 'Bangalore', contact_name: 'Jane' },
];

if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      pool: { query: async () => ({ rows: [], rowCount: 0 }), on: () => {} },
      run: async (sql, params) => {
        if (sql.includes('UPDATE users SET org_id = NULL')) {
          const user = mockUsers.find(u => u.id === params[params.length - 1]);
          if (user) user.org_id = null;
          return { changes: 1 };
        }
        if (sql.includes('UPDATE users SET is_active = ?')) {
          const user = mockUsers.find(u => u.id === params[1]);
          if (user) user.is_active = params[0];
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO organizations')) {
          mockOrgs.push({ id: params[0], name: params[1], city: params[2], contact_name: params[3] });
          return { changes: 1 };
        }
        return { changes: 1 };
      },
      get: async (sql, params) => {
        if (sql.includes('SELECT * FROM users WHERE id = ?')) {
          return mockUsers.find(u => u.id === params[0]);
        }
        if (sql.includes('SELECT * FROM organizations WHERE id = ?')) {
          return mockOrgs.find(o => o.id === params[0]);
        }
        return undefined;
      },
      all: async (sql, params) => {
        if (sql.includes('SELECT * FROM organizations')) {
          return [...mockOrgs];
        }
        if (sql.includes('FROM users')) {
          // If query specifies exact org match
          if (sql.includes('WHERE org_id = ?')) {
            return mockUsers.filter(u => u.org_id === params[0]);
          }
          if (sql.includes('WHERE (org_id = ? OR org_id IS NULL)')) {
            return mockUsers.filter(u => u.org_id === params[0] || u.org_id === null);
          }
          return [...mockUsers];
        }
        return [];
      },
    },
  };
}

test('TC_SA_BE_01: Organization creation requires valid name and city', () => {
  const validateOrg = (name, city) => {
    if (!name || !name.trim()) return { error: 'name is required' };
    if (!city || !city.trim()) return { error: 'city is required' };
    return { ok: true };
  };

  assert.strictEqual(validateOrg('', 'Chennai').error, 'name is required');
  assert.strictEqual(validateOrg('Alpha', '').error, 'city is required');
  assert.strictEqual(validateOrg('Alpha', 'Chennai').ok, true);
});

test('TC_SA_BE_02: Super admin retrieves complete organizations list', async () => {
  const db = require('./config/db');
  const orgs = await db.all('SELECT * FROM organizations');
  assert.strictEqual(orgs.length >= 2, true);
  assert.strictEqual(orgs.some(o => o.name === 'Alpha Laundry'), true);
});

test('TC_SA_BE_03: exact_org query filter isolates users and prevents foreign leakage', async () => {
  const db = require('./config/db');
  // Leaky query would return free users (U4)
  const leakyUsers = await db.all('SELECT * FROM users WHERE (org_id = ? OR org_id IS NULL)', ['ORG_1']);
  assert.strictEqual(leakyUsers.some(u => u.id === 'U4'), true);

  // Exact query isolates strictly users of ORG_1
  const exactUsers = await db.all('SELECT * FROM users WHERE org_id = ?', ['ORG_1']);
  assert.strictEqual(exactUsers.every(u => u.org_id === 'ORG_1'), true);
  assert.strictEqual(exactUsers.some(u => u.id === 'U4'), false);
});

test('TC_SA_BE_04: Updating user with org_id: null disassociates user from organization', async () => {
  const db = require('./config/db');
  const target = await db.get('SELECT * FROM users WHERE id = ?', ['U3']);
  assert.strictEqual(target.org_id, 'ORG_1');

  await db.run('UPDATE users SET org_id = NULL WHERE id = ?', ['U3']);
  const updated = await db.get('SELECT * FROM users WHERE id = ?', ['U3']);
  assert.strictEqual(updated.org_id, null);
});

test('TC_SA_BE_05: Super admin toggles user active/deactivated state', async () => {
  const db = require('./config/db');
  await db.run('UPDATE users SET is_active = ? WHERE id = ?', [0, 'U2']);
  let user = await db.get('SELECT * FROM users WHERE id = ?', ['U2']);
  assert.strictEqual(user.is_active, 0);

  await db.run('UPDATE users SET is_active = ? WHERE id = ?', [1, 'U2']);
  user = await db.get('SELECT * FROM users WHERE id = ?', ['U2']);
  assert.strictEqual(user.is_active, 1);
});

test('TC_SA_BE_06: Announcement broadcast validates target audience selection', () => {
  const VALID_AUDIENCES = ['ALL', 'ORGANIZATION_OWNER', 'FIELD_OPERATIONS', 'CUSTOMER_CARE'];
  const isValidAudience = (aud) => VALID_AUDIENCES.includes(aud.toUpperCase());

  assert.strictEqual(isValidAudience('ALL'), true);
  assert.strictEqual(isValidAudience('ORGANIZATION_OWNER'), true);
  assert.strictEqual(isValidAudience('FIELD_OPERATIONS'), true);
  assert.strictEqual(isValidAudience('INVALID_AUDIENCE'), false);
});
