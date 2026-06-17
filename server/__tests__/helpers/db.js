// to help clean up the database in between tests
const pool = require('../../db');

// delete in reverse order of dependencies (so that we dont have foreign key constraint issues)
async function cleanDatabase() {
    await pool.query('DELETE FROM items');
    await pool.query('DELETE FROM brand_products');
    await pool.query('DELETE FROM food_types');
    await pool.query('DELETE FROM categories');
    await pool.query('DELETE FROM user_household');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM households');
}
// catalog tables are wiped too 
// each test seeds the exact rows it needs

module.exports = { cleanDatabase };