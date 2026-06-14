// set up the test for /api/v1/auth endpoints

const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const { cleanDatabase } = require('./helpers/db');

// clean database before each test
beforeEach(async () => {
    await cleanDatabase();
})

afterAll(async () => {
    await pool.end();
});

describe('POST /api/v1/auth/signup', () => {
    test('returns 201 w user and token for valid input', async () => {
        const resp = await request(app)
            .post('/api/v1/auth/signup').send({
                email: 'test@example.com',
                password: 'password123',
                display_name: 'Test User'
            });
        
            expect(resp.status).toBe(201);
            expect(resp.body).toHaveProperty('user');
            expect(resp.body).toHaveProperty('token');
            expect(resp.body.user.email).toBe('test@example.com');
            expect(resp.body.user.display_name).toBe('Test User');
            expect(resp.body.user.password_hash).toBeUndefined(); // pw hash should not be returned
    });

});

