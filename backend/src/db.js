const { Pool, types } = require('pg');
require('dotenv').config();

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects
// to prevent timezone-induced off-by-one day shifts (BUG-005)
types.setTypeParser(1082, (val) => val);

// Return NUMERIC/DECIMAL columns as JS numbers instead of strings
// PostgreSQL OID 1700 = NUMERIC type
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

module.exports = pool;
