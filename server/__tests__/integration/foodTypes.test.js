const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertCategory, insertFoodType } = require('../helpers/catalog');

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('GET /food-types', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/food-types');
        expect(res.status).toBe(401);
    });

    test('returns the list of food types', async () => {
        const { token } = await signupAndGetToken();
        const categoryId = await insertCategory({ name: 'Dairy', fridge_days: 7 });
        await insertFoodType({ name: 'Milk', category_id: categoryId, fridge_days: 5 });
        await insertFoodType({ name: 'Cheese', category_id: categoryId, fridge_days: 30 });

        const res = await request(app)
            .get('/api/v1/food-types')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        // names should be alphabetical thanks to ORDER BY name
        expect(res.body[0].name).toBe('Cheese');
        expect(res.body[1].name).toBe('Milk');
        // for sanity, the row shld carry the hierarchical fields, not the old shape
        expect(res.body[1].category_id).toBe(categoryId);
        expect(res.body[1].fridge_days).toBe(5);
    });
});


describe('GET /food-types (household scoped)', () => {
    // a user sees public food types plus their own, never another household's private ones
    test('returns public food types and my own, not another household\'s', async () => {
        const { token, householdId } = await signupAndGetToken();
        const other = await signupAndGetToken();
        const catId = await insertCategory({ name: 'Dairy' });

        await insertFoodType({ name: 'Milk', category_id: catId });                                     // public
        await insertFoodType({ name: 'My Cheese', category_id: catId, household_id: householdId });     // mine
        await insertFoodType({ name: 'Their Cheese', category_id: catId, household_id: other.householdId }); // theirs

        const res = await request(app)
            .get('/api/v1/food-types')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const names = res.body.map(f => f.name);
        expect(names).toContain('Milk');
        expect(names).toContain('My Cheese');
        expect(names).not.toContain('Their Cheese');
    });
});

describe('POST /food-types', () => {
    // a brand new name is stored privately, stamped with my household
    test('creates a new private food type stamped with my household', async () => {
        const { token, householdId } = await signupAndGetToken();
        const catId = await insertCategory({ name: 'Dairy' });

        const res = await request(app)
            .post('/api/v1/food-types')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Kefir', category_id: catId });

        expect(res.status).toBe(201);
        expect(res.body.food_type.household_id).toBe(householdId);
    });

    // anti-shadowing: a name matching a public food type returns the public row, no duplicate
    test('reuses an existing public food type instead of shadowing it', async () => {
        const { token } = await signupAndGetToken();
        const catId = await insertCategory({ name: 'Dairy' });
        const publicId = await insertFoodType({ name: 'Milk', category_id: catId });

        const res = await request(app)
            .post('/api/v1/food-types')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Milk', category_id: catId });

        expect(res.status).toBe(200);
        expect(res.body.food_type.id).toBe(publicId);
        expect(res.body.food_type.household_id).toBeNull();

        const count = await pool.query(
            'SELECT COUNT(*)::int AS n FROM food_types WHERE LOWER(name) = LOWER($1)', ['Milk']);
        expect(count.rows[0].n).toBe(1);
    });


    // validation guard: missing required field is rejected
    test('rejects when name is missing', async () => {
        const { token } = await signupAndGetToken();
        const catId = await insertCategory({ name: 'Dairy' });

        const res = await request(app)
            .post('/api/v1/food-types')
            .set('Authorization', `Bearer ${token}`)
            .send({ category_id: catId });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
});