const { Pool, types } = require('pg');               

// parse timestamptz as string to avoid timezone issues
types.setTypeParser(1114, str => str); 

const pool = new Pool({                        
  connectionString: process.env.DATABASE_URL,  
  ssl: { rejectUnauthorized: false },         
});

module.exports = pool;     