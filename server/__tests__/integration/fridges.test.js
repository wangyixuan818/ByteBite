const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertItem } = require('../helpers/items');

jest.setTimeout(20000);

beforeEach(async () => {
    await cleanDatabase();
});

afterAll(async () => {
    await pool.end();
});

describe('Fridge endpoints', () => {
    let token;
    let householdId;

    beforeEach(async () => {
        ({ token, householdId } = await signupAndGetToken());
    });

    describe('POST /fridges/initialize', () => {
        test('creates a fridge with default sections and pantry', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Home fridge', model_type: 'three_layered' });

            expect(res.status).toBe(201);
            expect(res.body.fridge.name).toBe('Home fridge');
            expect(res.body.fridge.model_type).toBe('three_layered');
            expect(res.body.fridge.sections.map(section => section.section_key)).toEqual([
                'upper',
                'middle',
                'lower',
                'pantry',
            ]);
            expect(res.body.fridge.sections.find(section => section.section_key === 'middle').section_type).toBe('fresh_zone');
            expect(res.body.mapped_items_count).toBe(0);
        });

        test('uses customized section types and door settings', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Custom fridge',
                    model_type: 'two_layered',
                    sections: [
                        { section_key: 'upper', section_type: 'fridge', has_door_space: true },
                        { section_key: 'lower', section_type: 'freezer', has_door_space: false },
                    ],
                });

            expect(res.status).toBe(201);
            const upper = res.body.fridge.sections.find(section => section.section_key === 'upper');
            const lower = res.body.fridge.sections.find(section => section.section_key === 'lower');
            expect(upper.section_type).toBe('fridge');
            expect(upper.has_door_space).toBe(true);
            expect(lower.section_type).toBe('freezer');
            expect(lower.has_door_space).toBe(false);
        });

        test('maps existing items into matching sections', async () => {
            const fridgeItem = await insertItem({ household_id: householdId, name: 'Milk', storage: 'fridge' });
            const freezerItem = await insertItem({ household_id: householdId, name: 'Chicken', storage: 'freezer' });
            const doorItem = await insertItem({ household_id: householdId, name: 'Ketchup', storage: 'fridge door' });
            const pantryItem = await insertItem({ household_id: householdId, name: 'Rice', storage: 'pantry' });

            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Home fridge', model_type: 'side_by_side' });

            expect(res.status).toBe(201);
            expect(res.body.mapped_items_count).toBe(4);

            const mapped = await pool.query(
                `SELECT id, fridge_id, storage_section_id, storage, is_in_door
                 FROM items
                 WHERE id = ANY($1::bigint[])
                 ORDER BY id`,
                [[fridgeItem.id, freezerItem.id, doorItem.id, pantryItem.id]]
            );
            const byId = new Map(mapped.rows.map(item => [item.id, item]));

            expect(byId.get(fridgeItem.id).storage_section_id).toBeTruthy();
            expect(byId.get(fridgeItem.id).storage).toBe('fridge');
            expect(byId.get(freezerItem.id).storage_section_id).toBeTruthy();
            expect(byId.get(freezerItem.id).storage).toBe('freezer');
            expect(byId.get(doorItem.id).storage_section_id).toBeTruthy();
            expect(byId.get(doorItem.id).storage).toBe('fridge door');
            expect(byId.get(doorItem.id).is_in_door).toBe(true);
            expect(byId.get(pantryItem.id).storage_section_id).toBeTruthy();
            expect(byId.get(pantryItem.id).storage).toBe('pantry');
            expect(byId.get(pantryItem.id).fridge_id).toBeNull();
        });

        test('rejects pantry as a customized fridge section', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Wrong fridge',
                    model_type: 'mini',
                    sections: [{ section_key: 'main', section_type: 'pantry' }],
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /fridges', () => {
        test('lists fridges in my household with sections', async () => {
            await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Home fridge', model_type: 'mini' });

            const res = await request(app)
                .get('/api/v1/fridges')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Home fridge');
            expect(res.body[0].sections.some(section => section.section_key === 'pantry')).toBe(true);
        });
    });
});
