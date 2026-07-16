const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertCategory } = require('../helpers/catalog');

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('GET /categories', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/categories');
        expect(res.status).toBe(401);
    });

    // scoping: a user sees public categories plus their own, never another household's private ones
    test('returns public categories and my own, not another household\'s', async () => {
        const { token, householdId } = await signupAndGetToken();
        const other = await signupAndGetToken();

        await insertCategory({ name: 'Dairy' });                                        // public
        await insertCategory({ name: 'My Snacks', household_id: householdId });          // mine
        await insertCategory({ name: 'Their Snacks', household_id: other.householdId }); // theirs

        const res = await request(app)
            .get('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const names = res.body.map(c => c.name);
        expect(names).toContain('Dairy');
        expect(names).toContain('My Snacks');
        expect(names).not.toContain('Their Snacks');
    });
});

describe('POST /categories', () => {
    // a brand new name is stored privately, stamped with my household
    test('creates a new private category stamped with my household', async () => {
        const { token, householdId } = await signupAndGetToken();

        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Condiments' });

        expect(res.status).toBe(201);
        expect(res.body.category.name).toBe('Condiments');
        expect(res.body.category.household_id).toBe(householdId);
    });

    // anti-shadowing: a name matching a public category returns the public row, creates no duplicate
    test('reuses an existing public category instead of shadowing it', async () => {
        const { token } = await signupAndGetToken();
        const publicId = await insertCategory({ name: 'Dairy' });

        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Dairy' });

        expect(res.status).toBe(200);                        // reused, not created
        expect(res.body.category.id).toBe(publicId);
        expect(res.body.category.household_id).toBeNull();

        const count = await pool.query(
            'SELECT COUNT(*)::int AS n FROM categories WHERE LOWER(name) = LOWER($1)', ['Dairy']);
        expect(count.rows[0].n).toBe(1);
    });

    // repeating a name I already own privately returns my existing row
    test('reuses my own private category on a repeat create', async () => {
        const { token, householdId } = await signupAndGetToken();
        const mineId = await insertCategory({ name: 'Condiments', household_id: householdId });

        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Condiments' });

        expect(res.status).toBe(200);
        expect(res.body.category.id).toBe(mineId);
    });

        // rejects a create with no name (covers the name guard)
    test('rejects when name is missing', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ default_storage: 'fridge' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    // rejects an invalid default_storage value (covers the storage guard)
    test('rejects an invalid default_storage', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Weird', default_storage: 'cupboard' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});