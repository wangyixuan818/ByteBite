// __tests__/integration/items.test.js

const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertCategory, insertFoodType, insertBrandProduct } = require('../helpers/catalog');

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
        describe('cascading auto-expiry', () => {
            // default: expiry provided by user
            test('user provided expiry date', async () => {
                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Eggs', expiry_date: '2026-06-30', storage: 'fridge' });
                
                expect(res.status).toBe(201);
                expect(res.body.item.name).toBe('Eggs');
                expect(res.body.item.expiry_date).toBe('2026-06-30');
                expect(res.body.item.expiry_is_estimated).toBe(false);
            });


            // path 1: explicit brand_product_id goes straight to the brand tier
            test('uses the brand_product shelf life when brand_product_id is given', async () => {
                const foodTypeId = await insertFoodType({ name: 'Milk', fridge_days: 9 });
                const brandId = await insertBrandProduct({ brand: 'HL', food_type_id: foodTypeId, fridge_days: 5 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'HL Milk', brand_product_id: brandId,
                            added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-06');   // brand's 5 days, not product's 9
                expect(res.body.item.expiry_is_estimated).toBe(true);
                expect(res.body.item.brand_product_id).toBe(brandId);
                expect(res.body.item.food_type_id).toBe(foodTypeId);    // derived from the brand row
            });


            // path 2 (product level): user picked a food_type that has its own fridge_days
            test('uses the food_type shelf life when a product is selected', async () => {
                const foodTypeId = await insertFoodType({ name: 'Milk', fridge_days: 5 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Milk', food_type_id: foodTypeId,
                            added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-06');   // 2026-01-01 + 5
                expect(res.body.item.expiry_is_estimated).toBe(true);
                expect(res.body.item.food_type_id).toBe(foodTypeId);    
            });

            // path 2 fallback: product has no fridge_days, so cascade falls to its category
            test('falls back to the category when the product has no shelf life for that storage', async () => {
                const categoryId = await insertCategory({ name: 'Dairy', fridge_days: 7 });
                const foodTypeId = await insertFoodType({ name: 'Milk', category_id: categoryId, fridge_days: null });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Milk', food_type_id: foodTypeId,
                            added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-08');   // 2026-01-01 + 7 (from category)
                expect(res.body.item.expiry_is_estimated).toBe(true);
                expect(res.body.item.food_type_id).toBe(foodTypeId);    // still records which product
            });

            // path 3: only a category given
            test('uses the category shelf life when only category_id is given', async () => {
                const categoryId = await insertCategory({ name: 'Dairy', fridge_days: 7 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Generic dairy thing', category_id: categoryId,
                            added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-08');   // 1 + 7
                expect(res.body.item.expiry_is_estimated).toBe(true);
            });


            // path 4a: free text matches a brand_product by name
            test('name-matches a brand_product when no ids are given', async () => {
                const foodTypeId = await insertFoodType({ name: 'Milk', fridge_days: 6 });
                const brandId = await insertBrandProduct({ brand: 'HL', food_type_id: foodTypeId, fridge_days: 4 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'HL Milk carton', added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-05');   // brand's 4 days
                expect(res.body.item.brand_product_id).toBe(brandId);
                expect(res.body.item.food_type_id).toBe(foodTypeId);
            });


            // path 4b: free text matches a food_type by name (no brand match)
            test('name-matches a food_type when no ids and no brand match', async () => {
                const foodTypeId = await insertFoodType({ name: 'Milk', fridge_days: 6 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Fresh Milk', added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-07');   // 1 + 6
                expect(res.body.item.food_type_id).toBe(foodTypeId);
            });



            // storage selection: freezer should read freezer_days, not fridge_days
            test('reads freezer_days when storage is freezer', async () => {
                const foodTypeId = await insertFoodType({ name: 'Chicken', fridge_days: 2, freezer_days: 10 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Chicken', food_type_id: foodTypeId,
                            added_date: '2026-01-01', storage: 'freezer' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe('2026-01-11');   // 1 + 10 (freezer)
            });


            // storage omitted: should be filled in from the matched row's default_storage
            test('fills storage from the catalog default_storage when none is given', async () => {
                const foodTypeId = await insertFoodType({ name: 'Yogurt',
                    default_storage: 'fridge', fridge_days: 14, freezer_days: 60 });

                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Yogurt', food_type_id: foodTypeId, added_date: '2026-01-01' });

                expect(res.status).toBe(201);
                expect(res.body.item.storage).toBe('fridge');           // filled from default_storage
                expect(res.body.item.expiry_date).toBe('2026-01-15');   // used fridge_days (14)
            });


            // nothing matches anywhere
            test('leaves expiry null when nothing in the catalog matches', async () => {
                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Some Mystery Snack', added_date: '2026-01-01', storage: 'fridge' });

                expect(res.status).toBe(201);
                expect(res.body.item.expiry_date).toBe(null);
                expect(res.body.item.expiry_is_estimated).toBe(false);
            });

        });
            
        describe('validation', () => {

            test('rejects when name is missing', async () => {
                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ quantity: 1 });

                expect(res.status).toBe(400);
                expect(res.body.error.code).toBe('VALIDATION_ERROR');
            });

            test('rejects an invalid storage value', async () => {
                const res = await request(app)
                    .post('/api/v1/items')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ name: 'Cheese', storage: 'cupboard' });

                expect(res.status).toBe(400);
                expect(res.body.error.code).toBe('VALIDATION_ERROR');
            });

        });
    });



    describe('GET /items', () => {

        test('returns the items in my household', async () => {
            await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });
            await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Bread', expiry_date: '2026-02-05' });

            const res = await request(app)
                .get('/api/v1/items')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });

        // a user shouldnt see another household's items
        test('does not return items from another household', async () => {
            // current user (token) makes an item
            await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });

            // a brand new user in their own household lists items
            const other = await signupAndGetToken();
            const res = await request(app)
                .get('/api/v1/items')
                .set('Authorization', `Bearer ${other.token}`);

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(0);
        });
    });


    describe('GET /items/:id', () => {
        test('returns a single item', async () => {
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });
            const id = created.body.item.id;

            const res = await request(app)
                .get(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.item.id).toBe(id);
            expect(res.body.item.name).toBe('Eggs');
        });

        test('returns 404 for an item that does not exist', async () => {
            const res = await request(app)
                .get('/api/v1/items/99999999')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });

        // cant read someone else's item even with the right id
        test('returns 404 for an item in another household', async () => {
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });
            const id = created.body.item.id;

            const other = await signupAndGetToken();
            const res = await request(app)
                .get(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${other.token}`);

            expect(res.status).toBe(404);
        });
    });



    describe('PATCH /items/:id', () => {
        test('updates a field', async () => {
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Milk', unit: 'carton', expiry_date: '2026-02-01' });
            const id = created.body.item.id;

            const res = await request(app)
                .patch(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ unit: 'bottle' });

            expect(res.status).toBe(200);
            expect(res.body.item.unit).toBe('bottle');
        });

        // adding an expiry date manually should turn off the estimated flag
        test('flips expiry_is_estimated to false when an expiry_date is set', async () => {
            const foodTypeId = await insertFoodType({ name: 'Milk', fridge_days: 5 });
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Milk', food_type_id: foodTypeId, added_date: '2026-01-01', storage: 'fridge' });
            const id = created.body.item.id;
            expect(created.body.item.expiry_is_estimated).toBe(true);   // estimated to begin with

            const res = await request(app)
                .patch(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ expiry_date: '2026-03-10' });

            expect(res.status).toBe(200);
            expect(res.body.item.expiry_date).toBe('2026-03-10');
            expect(res.body.item.expiry_is_estimated).toBe(false);
        });

        test('can mark an item as consumed', async () => {
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });
            const id = created.body.item.id;

            const res = await request(app)
                .patch(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'consumed' });

            expect(res.status).toBe(200);
            expect(res.body.item.status).toBe('consumed');
        });

        test('returns 404 when patching an item that does not exist', async () => {
            const res = await request(app)
                .patch('/api/v1/items/3495445478')
                .set('Authorization', `Bearer ${token}`)
                .send({ unit: 'bottle' });

            expect(res.status).toBe(404);
        });
    });


    describe('DELETE /items/:id', () => {

        test('deletes an item', async () => {
            const created = await request(app).post('/api/v1/items').set('Authorization', `Bearer ${token}`)
                .send({ name: 'Eggs', expiry_date: '2026-02-01' });
            const id = created.body.item.id;

            const res = await request(app)
                .delete(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(204);

            // confirm its actually gone
            const check = await request(app)
                .get(`/api/v1/items/${id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(check.status).toBe(404);
        });

        test('returns 404 when deleting an item that does not exist', async () => {
            const res = await request(app)
                .delete('/api/v1/items/99999999')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
        });
    });
});

