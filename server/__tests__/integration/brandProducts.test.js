const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertFoodType, insertBrandProduct } = require('../helpers/catalog');

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('GET /brand-products', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/brand-products');
        expect(res.status).toBe(401);
    });

    // scoping: I see public brands plus my own, never another household's private ones
    test('returns public brands and my own, not another household\'s', async () => {
        const { token, householdId } = await signupAndGetToken();
        const other = await signupAndGetToken();
        const foodTypeId = await insertFoodType({ name: 'Milk' });

        await insertBrandProduct({ brand: 'PublicBrand', food_type_id: foodTypeId });                                 // public
        await insertBrandProduct({ brand: 'MyBrand', food_type_id: foodTypeId, household_id: householdId });          // mine
        await insertBrandProduct({ brand: 'TheirBrand', food_type_id: foodTypeId, household_id: other.householdId }); // theirs

        const res = await request(app)
            .get('/api/v1/brand-products')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const brands = res.body.map(b => b.brand);
        expect(brands).toContain('PublicBrand');
        expect(brands).toContain('MyBrand');
        expect(brands).not.toContain('TheirBrand');
    });

    // the optional food_type_id query param narrows results to one food type
    test('filters by food_type_id when provided', async () => {
        const { token } = await signupAndGetToken();
        const milkId = await insertFoodType({ name: 'Milk' });
        const juiceId = await insertFoodType({ name: 'Juice' });
        await insertBrandProduct({ brand: 'Marigold', food_type_id: milkId });
        await insertBrandProduct({ brand: 'Peel Fresh', food_type_id: juiceId });

        const res = await request(app)
            .get('/api/v1/brand-products')
            .query({ food_type_id: milkId })
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const brands = res.body.map(b => b.brand);
        expect(brands).toContain('Marigold');
        expect(brands).not.toContain('Peel Fresh');
    });
});