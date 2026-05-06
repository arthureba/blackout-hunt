const { Pool } = require('pg');

const sslConfig = () => {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('sslmode=disable')) return false;
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false };
  return false;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
