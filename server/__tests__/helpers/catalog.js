// inserts known catalog rows for tests, returns the new id so tests can reference them
const pool = require('../../db');

async function insertCategory({ name, default_storage = 'fridge',
                                pantry_days = null, fridge_days = null, freezer_days = null }) {
    const res = await pool.query(
        `INSERT INTO categories (name, default_storage, pantry_days, fridge_days, freezer_days)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, default_storage, pantry_days, fridge_days, freezer_days]
    );
    return res.rows[0].id;
}

async function insertFoodType({ name, category_id = null, default_storage = null,
                                pantry_days = null, fridge_days = null, freezer_days = null }) {
    const res = await pool.query(
        `INSERT INTO food_types (name, category_id, default_storage, pantry_days, fridge_days, freezer_days)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, category_id, default_storage, pantry_days, fridge_days, freezer_days]
    );
    return res.rows[0].id;
}

async function insertBrandProduct({ brand, food_type_id, default_storage = null,
                                    pantry_days = null, fridge_days = null, freezer_days = null }) {
    const res = await pool.query(
        `INSERT INTO brand_products (brand, food_type_id, default_storage, pantry_days, fridge_days, freezer_days)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [brand, food_type_id, default_storage, pantry_days, fridge_days, freezer_days]
    );
    return res.rows[0].id;
}

module.exports = { insertCategory, insertFoodType, insertBrandProduct };