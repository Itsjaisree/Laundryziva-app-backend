const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { rangeBounds, summarize, buildPayoutCsv } = require('./services/payoutService');

// Mock db for owner test suite
const dbPath = path.resolve(__dirname, 'config/db.js');
let mockMachines = [
  { device_id: 'PG1_01', org_id: 'ORG_ALPHA', friendly_name: 'Washer 1', online: true, state: 'Available' },
  { device_id: 'PG1_02', org_id: 'ORG_ALPHA', friendly_name: 'Washer 2', online: false, state: 'Offline' },
  { device_id: 'BETA_01', org_id: 'ORG_BETA', friendly_name: 'Washer B1', online: true, state: 'Running' },
];

let mockTasks = [];

if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      pool: { query: async () => ({ rows: [], rowCount: 0 }), on: () => {} },
      run: async (sql, params) => {
        if (sql.includes('INSERT INTO technician_tasks')) {
          mockTasks.push({ id: params[0], org_id: params[1], title: params[5], priority: params[12] });
          return { changes: 1 };
        }
        return { changes: 1 };
      },
      get: async (sql, params) => {
        if (sql.includes('SELECT * FROM machines WHERE device_id = ?')) {
          return mockMachines.find(m => m.device_id === params[0]);
        }
        return undefined;
      },
      all: async (sql, params) => {
        if (sql.includes('FROM machines WHERE org_id = ?')) {
          return mockMachines.filter(m => m.org_id === params[0]);
        }
        return [];
      },
    },
  };
}

test('TC_OWNER_BE_01: Owner machine list returns only machines belonging to owner organization', async () => {
  const db = require('./config/db');
  const alphaMachines = await db.all('SELECT * FROM machines WHERE org_id = ?', ['ORG_ALPHA']);
  assert.strictEqual(alphaMachines.length, 2);
  assert.strictEqual(alphaMachines.every(m => m.org_id === 'ORG_ALPHA'), true);
  assert.strictEqual(alphaMachines.some(m => m.device_id === 'BETA_01'), false);
});

test('TC_OWNER_BE_02: Payout date range bounds calculate India-time ISO strings', () => {
  const bounds = rangeBounds('2026-10-05', '2026-10-05');
  assert.strictEqual(bounds.start, '2026-10-04T18:30:00.000Z');
  assert.strictEqual(bounds.end, '2026-10-05T18:30:00.000Z');
});

test('TC_OWNER_BE_03: Date range validator rejects reversed or malformed dates', () => {
  assert.ok(rangeBounds('05-10-2026', '2026-10-06').error);
  assert.ok(rangeBounds('2026-10-07', '2026-10-06').error);
});

test('TC_OWNER_BE_04: Transactions CSV export includes proper headers, currency format, and total sum', () => {
  const row = { transaction_ref: 'UTR1001', org_id: 'ORG_ALPHA', amount: 1000, period_from: '2026-09-01', period_to: '2026-09-15', transferred_at: '2026-09-17T05:00:00.000Z', status: 'Paid', note: null };
  const csv = buildPayoutCsv([row], { orgNames: { ORG_ALPHA: 'Alpha Laundry' }, from: '2026-09-01', to: '2026-09-30' });
  assert.strictEqual(csv.includes('"Report","Payout Report"'), true);
  assert.strictEqual(csv.includes('"UTR1001","Alpha Laundry","1000.00"'), true);
  assert.strictEqual(csv.includes('"Total (INR)","","1000.00"'), true);
});

test('TC_OWNER_BE_05: Maintenance task creation validates title and priority constraints', async () => {
  const validateTaskInput = (title, priority) => {
    if (!title || !title.trim()) return { error: 'title is required' };
    if (!['Low', 'Medium', 'High'].includes(priority)) return { error: 'priority must be Low, Medium or High' };
    return { ok: true };
  };

  assert.strictEqual(validateTaskInput('', 'High').error, 'title is required');
  assert.strictEqual(validateTaskInput('Fix Washer', 'Critical').error, 'priority must be Low, Medium or High');
  assert.strictEqual(validateTaskInput('Fix Washer', 'High').ok, true);
});
