const pool = require('../db');

async function getHouseholdId(userId) {
    const res = await pool.query(
        `SELECT household_id FROM user_household WHERE user_id = $1 LIMIT 1`,
        [userId]
    );
    return res.rows[0]?.household_id;
}

module.exports = { getHouseholdId };