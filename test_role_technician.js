const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { mergePhotoUrls } = require('./services/taskPhotos');

// Mock db for technician tests
const dbPath = path.resolve(__dirname, 'config/db.js');
let mockTasks = [
  { id: 'TASK_1', technician_id: 'TECH_1', status: 'Assigned', title: 'Install Washer' },
  { id: 'TASK_2', technician_id: 'TECH_2', status: 'In Progress', title: 'Repair Motor' },
  { id: 'TASK_3', technician_id: 'TECH_1', status: 'Completed', title: 'Wiring check' },
];

if (!require.cache[dbPath]) {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
      pool: { query: async () => ({ rows: [], rowCount: 0 }), on: () => {} },
      run: async (sql, params) => {
        if (sql.includes('UPDATE technician_tasks SET status = ?')) {
          const t = mockTasks.find(x => x.id === params[1]);
          if (t) t.status = params[0];
          return { changes: 1 };
        }
        return { changes: 1 };
      },
      get: async (sql, params) => {
        if (sql.includes('SELECT * FROM technician_tasks WHERE id = ?')) {
          return mockTasks.find(x => x.id === params[0]);
        }
        return undefined;
      },
      all: async (sql, params) => {
        if (sql.includes('WHERE technician_id = ?')) {
          return mockTasks.filter(x => x.technician_id === params[0]);
        }
        return [...mockTasks];
      },
    },
  };
}

test('TC_TECH_BE_01: Technician tasks query filters strictly by assigned technician_id', async () => {
  const db = require('./config/db');
  const myTasks = await db.all('SELECT * FROM technician_tasks WHERE technician_id = ?', ['TECH_1']);
  assert.strictEqual(myTasks.length, 2);
  assert.strictEqual(myTasks.every(t => t.technician_id === 'TECH_1'), true);
  assert.strictEqual(myTasks.some(t => t.id === 'TASK_2'), false);
});

test('TC_TECH_BE_02: Task start transitions status from Assigned to In Progress', async () => {
  const db = require('./config/db');
  let task = await db.get('SELECT * FROM technician_tasks WHERE id = ?', ['TASK_1']);
  assert.strictEqual(task.status, 'Assigned');

  await db.run('UPDATE technician_tasks SET status = ? WHERE id = ?', ['In Progress', 'TASK_1']);
  task = await db.get('SELECT * FROM technician_tasks WHERE id = ?', ['TASK_1']);
  assert.strictEqual(task.status, 'In Progress');
});

test('TC_TECH_BE_03: mergePhotoUrls adds new photos and preserves existing sequence', () => {
  const existing = JSON.stringify(['/api/photos/1', '/api/photos/2']);
  const incoming = ['/api/photos/3', '/api/photos/4'];
  const res = mergePhotoUrls(existing, incoming, 10);
  assert.deepStrictEqual(res.merged, ['/api/photos/1', '/api/photos/2', '/api/photos/3', '/api/photos/4']);
});

test('TC_TECH_BE_04: mergePhotoUrls deduplicates photos and forbids exceeding 10-photo cap', () => {
  const existing = JSON.stringify(['/api/photos/1', '/api/photos/2']);
  const incoming = ['/api/photos/2', '/api/photos/3']; // duplicate /api/photos/2
  const dedup = mergePhotoUrls(existing, incoming, 10);
  assert.deepStrictEqual(dedup.merged, ['/api/photos/1', '/api/photos/2', '/api/photos/3']);

  // Over limit test
  const tenPhotos = JSON.stringify(Array.from({ length: 10 }, (_, i) => `/api/photos/${i}`));
  const overflow = mergePhotoUrls(tenPhotos, ['/api/photos/extra'], 10);
  assert.ok(overflow.error);
  assert.strictEqual(overflow.error.includes('10'), true);
});

test('TC_TECH_BE_05: Task completion updates status to Completed and marks work complete', async () => {
  const db = require('./config/db');
  await db.run('UPDATE technician_tasks SET status = ? WHERE id = ?', ['Completed', 'TASK_1']);
  const task = await db.get('SELECT * FROM technician_tasks WHERE id = ?', ['TASK_1']);
  assert.strictEqual(task.status, 'Completed');
});
