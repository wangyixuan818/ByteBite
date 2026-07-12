// set up the test for /api/v1/auth endpoints

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');

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


    test('returns 400 for invalid input', async () => {
        const resp = await request(app)
            .post('/api/v1/auth/signup').send({ email: 'notanemail', password: 'short', display_name: '' });

        expect(resp.status).toBe(400);
        expect(resp.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 409 when the email already exists', async () => {
        const body = { email: 'dupe@example.com', password: 'password123', display_name: 'Dupe' };
        await request(app).post('/api/v1/auth/signup').send(body);   // first succeeds

        const resp = await request(app).post('/api/v1/auth/signup').send(body);   // second collides
        expect(resp.status).toBe(409);
        expect(resp.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

});



describe('POST /api/v1/auth/login', () => {
    const creds = { email: 'login@example.com', password: 'password123', display_name: 'Login User' };

    test('logs in with correct credentials', async () => {
        await request(app).post('/api/v1/auth/signup').send(creds);

        const resp = await request(app)
            .post('/api/v1/auth/login').send({ email: creds.email, password: creds.password });

        expect(resp.status).toBe(200);
        expect(resp.body).toHaveProperty('token');
        expect(resp.body.user.email).toBe(creds.email);
        expect(resp.body.user.password_hash).toBeUndefined();
    });

    test('returns 400 for invalid input', async () => {
        const resp = await request(app).post('/api/v1/auth/login').send({ email: 'bad' });
        expect(resp.status).toBe(400);
        expect(resp.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 401 for an unknown email', async () => {
        const resp = await request(app)
            .post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
        expect(resp.status).toBe(401);
        expect(resp.body.error.code).toBe('INVALID_USER');
    });

    test('returns 401 for a wrong password', async () => {
        await request(app).post('/api/v1/auth/signup').send(creds);

        const resp = await request(app)
            .post('/api/v1/auth/login').send({ email: creds.email, password: 'wrongpassword' });
        expect(resp.status).toBe(401);
        expect(resp.body.error.code).toBe('INVALID_PASSWORD');
    });
});

describe('GET /api/v1/auth/me', () => {
    test('returns the current user with a valid token', async () => {
        const signup = await request(app).post('/api/v1/auth/signup')
            .send({ email: 'me@example.com', password: 'password123', display_name: 'Me' });

        const resp = await request(app)
            .get('/api/v1/auth/me').set('Authorization', `Bearer ${signup.body.token}`);

        expect(resp.status).toBe(200);
        expect(resp.body.user.email).toBe('me@example.com');
    });

    test('returns 401 without a token', async () => {
        const resp = await request(app).get('/api/v1/auth/me');
        expect(resp.status).toBe(401);
    });
});

describe('POST /api/v1/auth/logout', () => {
    test('returns 204 with a valid token', async () => {
        const signup = await request(app).post('/api/v1/auth/signup')
            .send({ email: 'out@example.com', password: 'password123', display_name: 'Out' });

        const resp = await request(app)
            .post('/api/v1/auth/logout').set('Authorization', `Bearer ${signup.body.token}`);
        expect(resp.status).toBe(204);
    });
});

