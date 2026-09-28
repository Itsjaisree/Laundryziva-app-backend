const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client:', err);
});

pool.query('SELECT 1')
  .then(() => console.log(`Connected to PostgreSQL database.`))
  .catch((err) => console.error('Error connecting to PostgreSQL database:', err));

// The rest of the codebase writes queries with SQLite-style "?" placeholders — translate
// them to Postgres's positional "$1, $2, ..." so controllers didn't need to be rewritten.
const toPositional = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

const run = async (sql, params = []) => {
  const result = await pool.query(toPositional(sql), params);
  return { changes: result.rowCount, rows: result.rows };
};

const get = async (sql, params = []) => {
  const result = await pool.query(toPositional(sql), params);
  return result.rows[0];
};

const all = async (sql, params = []) => {
  const result = await pool.query(toPositional(sql), params);
  return result.rows;
};

module.exports = {
  pool,
  run,
  get,
  all,
};
