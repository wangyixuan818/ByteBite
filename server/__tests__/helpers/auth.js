// helper for test that needs a logged in user

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let testUserCounter = 0; // to generate unique emails for each test user

async function signupAndGetToken(displayName = 'Test User') {
    // generate a new email everytime for isolation (else will crash!!!!)
    testUserCounter++; // will start from 1
    const email = `test-${testUserCounter}@example.com`;
    const res = await request(app)
        .post('/api/v1/auth/signup').send({ email, password: 'password123', display_name: displayName });

    // look up the household that signup auto-created for this user
    const hh = await pool.query(
        'SELECT household_id FROM user_household WHERE user_id = $1 LIMIT 1',
        [res.body.user.id]
    );

    return { token: res.body.token, user: res.body.user, householdId: hh.rows[0].household_id };
}

// inserts known catalog rows for tests, returns the new id so tests can reference them
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
module.exports = { signupAndGetToken };