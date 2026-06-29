const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

afterAll(async () => {
    await pool.end();
});

describe('JWT auth middleware', () => {

    test('rejects with 401 UNAUTHENTICATED when no Authorisation header is sent', async () => {
        const res = await request(app).get('/api/v1/items');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('rejects with 401 UNAUTHENTICATED when header is malformed', async () => {
        const res = await request(app)
            .get('/api/v1/items')
            .set('Authorization', 'totally-not-a-bearer-token');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('rejects with 401 UNAUTHORIZED when the token is invalid', async () => {
        // valid Bearer shape, but the token itself is junk so jwt throws error
        const res = await request(app)
            .get('/api/v1/items')
            .set('Authorization', 'Bearer not-a-real-jwt');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

});