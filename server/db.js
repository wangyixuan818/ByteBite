const { Pool, types } = require('pg');    

// DATE columns return the raw 'YYYY-MM-DD' string, not a JS Date,
// so JSON responses don't get timezone-shifted into UTC timestamps
types.setTypeParser(types.builtins.DATE, val => val);

// returns in number
types.setTypeParser(types.builtins.INT8, val => Number(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;     