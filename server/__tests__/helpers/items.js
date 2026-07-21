const pool = require('../../db');

async function insertItem({ household_id, name = 'TestItem', expiry_date = null,
                            status = 'active', storage = 'fridge', created_by = null,
                            quantity = null, initial_quantity = quantity }) {
    const res = await pool.query(
        `INSERT INTO items (household_id, name, expiry_date, status, storage, created_by, quantity, initial_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [household_id, name, expiry_date, status, storage, created_by, quantity, initial_quantity]
    );
    return res.rows[0];
}

module.exports = { insertItem };
