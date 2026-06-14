// __tests__/integration/items.test.js

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');

// clean database before each test
beforeEach(async () => {
    await cleanDatabase();
})

afterAll(async () => {
    await pool.end();
});


describe('Item endpoints', () => {
    
    let token;

    beforeEach(async () => {
        ({ token } = await signupAndGetToken());
    });


    // post /items
    describe('POST /items', () => {
        describe('automatic expiry', () => {
            
            // default: expiry provided by user
            test('user provided expiry date', async () => {
                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Eggs', expiry_date: '2026-06-31', storage: 'fridge' });
                
                expect(res.status).toBe(201);
                expect(res.body.item.name).toBe('Eggs');
                expect(res.body.item.expiry_date).toBe('2026-06-31');
                expect(res.body.item.expiry_is_estimated).toBe(false);
            });

            // expiry provided by user and different from food type default

            // no expiry provided, but food type is in default database

            // no expiry and food type not in default database

        });
    });
});



test.todo('GET /items returns the household items');
test.todo('POST /items creates an item');
test.todo('POST /items auto-fills expiry from food_types');
test.todo('PATCH /items/:id flips expiry_is_estimated when expiry_date is defined');
test.todo('DELETE /items/:id removes the item');
test.todo('rejects POST /items if food type id is invalid');