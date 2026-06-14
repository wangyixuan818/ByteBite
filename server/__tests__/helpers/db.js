// to help clean up the database in between tests

const pool = require('../../db');

// delete in reverse order of dependencies (so that we dont have foreign key constraint issues)
async function cleanDatabase() {
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM user_household');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM households');
}
// dont delete food types data (bec that's kept throughout)

module.exports = { cleanDatabase };