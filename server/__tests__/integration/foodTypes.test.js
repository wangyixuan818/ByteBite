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