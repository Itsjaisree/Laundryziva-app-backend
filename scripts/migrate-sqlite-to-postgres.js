// One-off migration: copies all rows from the old laundryziva.db (SQLite) into the
// already-initialized Postgres database pointed to by DATABASE_URL.
// Usage: DATABASE_URL=postgresql://... node scripts/migrate-sqlite-to-postgres.js /path/to/laundryziva.db
const { execFileSync } = require('child_process');
const { Pool } = require('pg');

const SQLITE_PATH = process.argv[2];
if (!SQLITE_PATH) {
  console.error('Usage: node migrate-sqlite-to-postgres.js <path-to-sqlite-db>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

// Order respects foreign key dependencies.
const TABLES = [
  'organizations',
  'roles',
  'permissions',
  'notification_types',
  'users',
  'machines',
  'deployments',
  'transactions',
  'notifications',
  'customer_care_tickets',
  'technician_tasks',
  'task_messages',
  'revoked_tokens',
];

const dumpTable = (table) => {
  const output = execFileSync('sqlite3', ['-json', SQLITE_PATH, `SELECT * FROM ${table};`], { maxBuffer: 100 * 1024 * 1024 });
  const text = output.toString().trim();
  return text ? JSON.parse(text) : [];
};

const migrate = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const table of TABLES) {
    let rows;
    try {
      rows = dumpTable(table);
    } catch (err) {
      console.warn(`Skipping ${table}: ${err.message}`);
      continue;
    }
    if (rows.length === 0) {
      console.log(`${table}: 0 rows, skipping`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const colList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      await pool.query(insertSql, values);
      inserted++;
    }
    console.log(`${table}: migrated ${inserted} rows`);
  }

  await pool.end();
  console.log('Migration complete.');
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
