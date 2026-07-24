const pool = require('../db');

async function getHouseholdId(userId, requestedHouseholdId = null) {
    if (requestedHouseholdId) {
        const res = await pool.query(
            `SELECT household_id FROM user_household WHERE user_id = $1 AND household_id = $2`,
            [userId, requestedHouseholdId]
        );
        return res.rows[0]?.household_id;
    }

    const res = await pool.query(
        `SELECT household_id FROM user_household WHERE user_id = $1 LIMIT 1`,
        [userId]
    );
    return res.rows[0]?.household_id;
}

async function requireHouseholdId(req, res, requestedHouseholdId = null) {
    const householdId = await getHouseholdId(req.user.userId, requestedHouseholdId);
    if (!householdId) {
        res.status(403).json({ error: {
            code: 'HOUSEHOLD_FORBIDDEN',
            message: 'You are not a member of this household'
        }});
        return null;
    }
    return householdId;
}

module.exports = { getHouseholdId, requireHouseholdId };
