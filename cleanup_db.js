const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'laundryziva.db'));

const stmts = [
  // Remove fake machines (keep only TITAN_1020BA01D418)
  "DELETE FROM machines WHERE device_id IN ('WM_PG2_102', 'DR_PG3_103')",
  // Remove seeded demo transaction
  "DELETE FROM transactions WHERE txn_id = 'TXN_9874101'",
  // Remove demo notifications
  "DELETE FROM notifications WHERE id IN ('NOTIF_1001','NOTIF_1002','NOTIF_1003','NOTIF_1004','NOTIF_1005')",
  // Remove demo tasks messages first (FK constraint)
  "DELETE FROM task_messages WHERE task_id IN ('TASK_DEMO_001','TASK_DEMO_002','TASK_DEMO_003','TASK_DEMO_004','TASK_DEMO_005')",
  // Remove demo tasks
  "DELETE FROM technician_tasks WHERE id IN ('TASK_DEMO_001','TASK_DEMO_002','TASK_DEMO_003','TASK_DEMO_004','TASK_DEMO_005')",
  // Remove demo users (keep super admin USR_28550797 and real owner USR_7E9B9136)
  "DELETE FROM users WHERE id IN ('USR_ORG_OWNER_DEMO','USR_TECH_DEMO','USR_CARE_DEMO')",
];

let i = 0;
const runNext = () => {
  if (i >= stmts.length) {
    console.log('\nAll cleanup done successfully.');

    db.all('SELECT device_id, friendly_name FROM machines', [], (e, rows) => {
      console.log('\n=== REMAINING MACHINES ===');
      rows.forEach(r => console.log(' -', r.device_id, '|', r.friendly_name));
    });
    db.all('SELECT txn_id, device_id FROM transactions', [], (e, rows) => {
      console.log('\n=== REMAINING TRANSACTIONS ===');
      if (rows.length === 0) console.log(' (none - clean)');
      rows.forEach(r => console.log(' -', r.txn_id, '|', r.device_id));
    });
    db.all('SELECT id, name, email, role_key FROM users', [], (e, rows) => {
      console.log('\n=== REMAINING USERS ===');
      rows.forEach(r => console.log(' -', r.id, '|', r.name, '|', r.role_key));
    });
    db.all('SELECT id FROM notifications', [], (e, rows) => {
      console.log('\n=== REMAINING NOTIFICATIONS ===', rows.length, 'records');
    });
    db.all('SELECT id FROM technician_tasks', [], (e, rows) => {
      console.log('\n=== REMAINING TASKS ===', rows.length, 'records');
      db.close();
    });
    return;
  }
  const sql = stmts[i++];
  db.run(sql, [], function(err) {
    if (err) { console.error('ERR:', err.message, '\nSQL:', sql); }
    else { console.log('OK (' + this.changes + ' rows):', sql.substring(0, 80)); }
    runNext();
  });
};
runNext();
