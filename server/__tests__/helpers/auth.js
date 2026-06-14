// helper for test that needs a logged in user

const request = require('supertest');
const app = require('../../app');

let testUserCounter = 0; // to generate unique emails for each test user

async function signupAndGetToken(displayName = 'Test User') {
    // generate a new email everytime for isolation (else will crash!!!!)
    testUserCounter++; // will start from 1
    const email = `test-${testUserCounter}@example.com`;
    
    const res = await request(app)
        .post('/api/v1/auth/signup').send({
            email: email,
            password: 'password123',
            display_name: displayName
        });
    return { token: res.body.token, user: res.body.user };
}

modules.exports = { signupAndGetToken };