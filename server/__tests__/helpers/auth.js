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

module.exports = { signupAndGetToken };