const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');

jest.setTimeout(20000);

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('Household endpoints', () => {
    test('lists households with code and members', async () => {
        const { token, user } = await signupAndGetToken('Alice');

        const res = await request(app)
            .get('/api/v1/households')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.households).toHaveLength(1);
        expect(res.body.households[0].code).toMatch(/^[0-9A-F]{10}$/);
        expect(res.body.households[0].members[0].id).toBe(user.id);
    });

    test('creates and joins households by code', async () => {
        const alice = await signupAndGetToken('Alice');
        const bob = await signupAndGetToken('Bob');

        const created = await request(app)
            .post('/api/v1/households')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ name: 'Dinner Club' });

        expect(created.status).toBe(201);

        const joined = await request(app)
            .post('/api/v1/households/join')
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ code: created.body.household.code.toLowerCase() });

        expect(joined.status).toBe(200);
        expect(joined.body.household.members.map(member => member.display_name).sort()).toEqual(['Alice', 'Bob']);
    });

    test('allows any member to rename a household', async () => {
        const alice = await signupAndGetToken('Alice');
        const bob = await signupAndGetToken('Bob');

        const created = await request(app)
            .post('/api/v1/households')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ name: 'Old Name' });
        await request(app)
            .post('/api/v1/households/join')
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ code: created.body.household.code });

        const renamed = await request(app)
            .patch(`/api/v1/households/${created.body.household.id}`)
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ name: 'New Name' });

        expect(renamed.status).toBe(200);
        expect(renamed.body.household.name).toBe('New Name');
    });

    test('blocks the last household member from leaving', async () => {
        const { token, householdId } = await signupAndGetToken('Solo');

        const res = await request(app)
            .delete(`/api/v1/households/${householdId}/members/me`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('LAST_HOUSEHOLD_MEMBER');
    });

    test('lets a member leave when someone else remains', async () => {
        const alice = await signupAndGetToken('Alice');
        const bob = await signupAndGetToken('Bob');
        const created = await request(app)
            .post('/api/v1/households')
            .set('Authorization', `Bearer ${alice.token}`)
            .send({ name: 'Shared' });
        await request(app)
            .post('/api/v1/households/join')
            .set('Authorization', `Bearer ${bob.token}`)
            .send({ code: created.body.household.code });

        const left = await request(app)
            .delete(`/api/v1/households/${created.body.household.id}/members/me`)
            .set('Authorization', `Bearer ${bob.token}`);

        expect(left.status).toBe(204);

        const forbidden = await request(app)
            .get(`/api/v1/households/${created.body.household.id}/members`)
            .set('Authorization', `Bearer ${bob.token}`);
        expect(forbidden.status).toBe(403);
    });
});
