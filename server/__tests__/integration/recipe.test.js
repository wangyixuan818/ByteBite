const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertFoodType } = require('../helpers/catalog');

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

// small helper: seed a recipe directly, optionally with linked food types
async function insertRecipe({ name, cuisine_type = 'other', food_type_ids = [] }) {
    const r = await pool.query(
        `INSERT INTO recipes (name, cuisine_type) VALUES ($1, $2) RETURNING id`,
        [name, cuisine_type]
    );
    const recipeId = r.rows[0].id;
    for (const ftId of food_type_ids) {
        await pool.query(
            `INSERT INTO recipe_food_types (recipe_id, food_type_id) VALUES ($1, $2)`,
            [recipeId, ftId]
        );
    }
    return recipeId;
}

describe('GET /recipes', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/recipes');
        expect(res.status).toBe(401);
    });

    // empty catalog: still returns 200 with an empty array
    test('returns an empty array when there are no recipes', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .get('/api/v1/recipes')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // multiple recipes: returns the whole list, sorted by id (as per route's ORDER BY)
    test('returns all recipes, ordered by id', async () => {
        const { token } = await signupAndGetToken();
        const idA = await insertRecipe({ name: 'Pasta', cuisine_type: 'italian' });
        const idB = await insertRecipe({ name: 'Ramen', cuisine_type: 'japanese' });

        const res = await request(app)
            .get('/api/v1/recipes')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].id).toBe(idA);
        expect(res.body[1].id).toBe(idB);
    });

    // aggregation: recipe with linked food types returns them in food_types_required
    test('aggregates linked food_type_ids into food_types_required', async () => {
        const { token } = await signupAndGetToken();
        const milkId = await insertFoodType({ name: 'Milk' });
        const eggId = await insertFoodType({ name: 'Egg' });
        const recipeId = await insertRecipe({ name: 'Omelette', cuisine_type: 'other',
                                              food_type_ids: [milkId, eggId] });;

        const res = await request(app)
            .get('/api/v1/recipes')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const row = res.body.find(r => r.id === recipeId);
        expect(row.food_types_required.map(String).sort()).toEqual([milkId, eggId].map(String).sort());
    });

    // recipe with no linked food types must return an empty array, not null (COALESCE fallback)
    test('returns an empty array for food_types_required when nothing is linked', async () => {
        const { token } = await signupAndGetToken();
        const recipeId = await insertRecipe({ name: 'Toast', cuisine_type: 'other' });

        const res = await request(app)
            .get('/api/v1/recipes')
            .set('Authorization', `Bearer ${token}`);

        const row = res.body.find(r => r.id === recipeId);
        expect(row.food_types_required).toEqual([]);
    });
});

describe('GET /recipes/:id', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/recipes/1');
        expect(res.status).toBe(401);
    });

    // happy path: returns the recipe object with aggregated food_types_required
    test('returns a single recipe with its food types', async () => {
        const { token } = await signupAndGetToken();
        const milkId = await insertFoodType({ name: 'Milk' });
        const recipeId = await insertRecipe({ name: 'Milkshake', cuisine_type: 'other',
                                        food_type_ids: [milkId] });

        const res = await request(app)
            .get(`/api/v1/recipes/${recipeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.recipe.id).toBe(recipeId);
        expect(res.body.recipe.name).toBe('Milkshake');
        expect(res.body.recipe.food_types_required.map(String)).toEqual([milkId].map(String));
    });

    // id validation: non-numeric id is rejected as 404 (route's Number.isInteger guard)
    test('returns 404 for a non-numeric id', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .get('/api/v1/recipes/abc')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
    });

    // id validation: zero / negative is also rejected as 404
    test('returns 404 for a non-positive id', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .get('/api/v1/recipes/0')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
    });

    // valid numeric id but no such recipe --> 404
    test('returns 404 when the recipe does not exist', async () => {
        const { token } = await signupAndGetToken();

        const res = await request(app)
            .get('/api/v1/recipes/99999999')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
    });
});