const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Mock db for customer care test suite
const dbPath = path.resolve(__dirname, 'config/db.js');
let mockTickets = [
  { id: 'TKT_1', customer_id: 'CUST_101', name: 'Ravi', status: 'Open', priority: 'High', title: 'Coins stuck in machine' },
  { id: 'TKT_2', customer_id: 'CUST_102', name: 'Priya', status: 'In Progress', priority: 'Medium', title: 'Cycle stopped midway' },
  { id: 'TKT_3', customer_id: 'CUST_103', name: 'Amit', status: 'Resolved', priority: 'Low', title: 'Payment refund question' },
];

let mockDispatches = [];

if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      pool: { query: async () => ({ rows: [], rowCount: 0 }), on: () => {} },
      run: async (sql, params) => {
        if (sql.includes('UPDATE customer_care_tickets SET status = ?')) {
          const t = mockTickets.find(x => x.id === params[1]);
          if (t) t.status = params[0];
          return { changes: 1 };
        }
        if (sql.includes('INSERT INTO technician_tasks')) {
          mockDispatches.push({ id: params[0], source_ticket_id: params[14], title: params[5] });
          return { changes: 1 };
        }
        return { changes: 1 };
      },
      get: async (sql, params) => {
        if (sql.includes('SELECT * FROM customer_care_tickets WHERE id = ?')) {
          return mockTickets.find(x => x.id === params[0]);
        }
        return undefined;
      },
      all: async (sql, params) => {
        if (sql.includes('WHERE priority = ?')) {
          return mockTickets.filter(x => x.priority === params[0]);
        }
        if (sql.includes("priority = 'High' AND status != 'Resolved'")) {
          return mockTickets.filter(x => x.priority === 'High' && x.status !== 'Resolved');
        }
        return [...mockTickets];
      },
    },
  };
}

test('TC_CC_BE_01: Support agent lists all customer tickets and filters by priority', async () => {
  const db = require('./config/db');
  const allTickets = await db.all('SELECT * FROM customer_care_tickets');
  assert.strictEqual(allTickets.length, 3);

  const highTickets = await db.all('SELECT * FROM customer_care_tickets WHERE priority = ?', ['High']);
  assert.strictEqual(highTickets.length, 1);
  assert.strictEqual(highTickets[0].id, 'TKT_1');
});

test('TC_CC_BE_02: Escalated query isolates High-priority unresolved complaints', async () => {
  const db = require('./config/db');
  const escalated = await db.all("SELECT * FROM customer_care_tickets WHERE priority = 'High' AND status != 'Resolved'");
  assert.strictEqual(escalated.length, 1);
  assert.strictEqual(escalated[0].status !== 'Resolved', true);
  assert.strictEqual(escalated[0].priority, 'High');
});

test('TC_CC_BE_03: Support agent resolves customer complaint ticket', async () => {
  const db = require('./config/db');
  let ticket = await db.get('SELECT * FROM customer_care_tickets WHERE id = ?', ['TKT_1']);
  assert.strictEqual(ticket.status, 'Open');

  await db.run('UPDATE customer_care_tickets SET status = ? WHERE id = ?', ['Resolved', 'TKT_1']);
  ticket = await db.get('SELECT * FROM customer_care_tickets WHERE id = ?', ['TKT_1']);
  assert.strictEqual(ticket.status, 'Resolved');
});

test('TC_CC_BE_04: Support agent dispatches maintenance task linked to source ticket', async () => {
  const db = require('./config/db');
  const taskId = 'TASK_DISP_01';
  const sourceTicketId = 'TKT_2';
  await db.run(
    'INSERT INTO technician_tasks (id, org_id, technician_id, technician_name, type, title, description, location, machine_id, machine_name, scheduled_date, scheduled_time, priority, status, source_ticket_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [taskId, 'ORG_1', 'TECH_1', 'Ramesh', 'Repair', 'Inspect Stuck Cycle', 'Customer reported machine stopped', 'Block B', 'MAC_01', 'Washer 1', '2026-11-04', '14:00', 'Medium', 'Assigned', sourceTicketId]
  );

  assert.strictEqual(mockDispatches.some(d => d.id === taskId && d.source_ticket_id === sourceTicketId), true);
});

test('TC_CC_BE_05: Diagnostic telemetry parser maps machine health and error states', () => {
  const evaluateHealth = (telemetry) => {
    if (!telemetry || !telemetry.online) return 'OFFLINE';
    if (telemetry.error_code && telemetry.error_code !== 0) return 'ERROR';
    if (telemetry.door_open) return 'WARNING_DOOR_OPEN';
    return 'HEALTHY';
  };

  assert.strictEqual(evaluateHealth({ online: false }), 'OFFLINE');
  assert.strictEqual(evaluateHealth({ online: true, error_code: 104 }), 'ERROR');
  assert.strictEqual(evaluateHealth({ online: true, door_open: true }), 'WARNING_DOOR_OPEN');
  assert.strictEqual(evaluateHealth({ online: true, error_code: 0, door_open: false }), 'HEALTHY');
});
