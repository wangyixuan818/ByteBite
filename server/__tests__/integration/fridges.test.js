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

    async function initializeFridge(body = {}) {
        const res = await request(app)
            .post('/api/v1/fridges/initialize')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Home fridge', model_type: 'three_layered', ...body });

        expect(res.status).toBe(201);
        return res.body.fridge;
    }

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

        test('uses custom section names and preserves custom section order', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Custom order fridge',
                    model_type: 'two_layered',
                    sections: [
                        { section_key: 'lower', name: 'Chilled drawers', section_type: 'fridge', has_door_space: false },
                        { section_key: 'upper', name: 'Frozen shelf', section_type: 'freezer', has_door_space: true },
                    ],
                });

            expect(res.status).toBe(201);
            expect(res.body.fridge.sections.map(section => section.section_key)).toEqual(['lower', 'upper', 'pantry']);
            expect(res.body.fridge.sections[0].name).toBe('Chilled drawers');
            expect(res.body.fridge.sections[0].position).toBe(0);
            expect(res.body.fridge.sections[1].name).toBe('Frozen shelf');
            expect(res.body.fridge.sections[1].position).toBe(1);
        });

        test('allows a custom section key and fills a fallback name', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Specialty fridge',
                    model_type: 'mini',
                    sections: [{ section_key: 'snack_drawer', section_type: 'fridge' }],
                });

            expect(res.status).toBe(201);
            const customSection = res.body.fridge.sections.find(section => section.section_key === 'snack_drawer');
            expect(customSection.name).toBe('snack_drawer');
            expect(customSection.has_door_space).toBe(true);
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

        test('rejects an invalid fridge model', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Odd fridge', model_type: 'walk_in' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('rejects custom sections with missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Incomplete fridge',
                    model_type: 'mini',
                    sections: [{ section_key: 'main' }],
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('rejects duplicate custom section keys for one fridge', async () => {
            const res = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Duplicate fridge',
                    model_type: 'two_layered',
                    sections: [
                        { section_key: 'upper', section_type: 'fridge' },
                        { section_key: 'upper', section_type: 'freezer' },
                    ],
                });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('FRIDGE_ALREADY_EXISTS');
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

        test('lists fridges for the selected household only', async () => {
            await initializeFridge({ name: 'Default household fridge', model_type: 'mini' });
            const createdHousehold = await request(app)
                .post('/api/v1/households')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Weekend house' });

            const secondHouseholdId = createdHousehold.body.household.id;
            await initializeFridge({
                name: 'Weekend fridge',
                household_id: secondHouseholdId,
                model_type: 'side_by_side',
            });

            const res = await request(app)
                .get(`/api/v1/fridges?household_id=${secondHouseholdId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Weekend fridge');
            expect(res.body[0].household_id).toBe(secondHouseholdId);
            expect(res.body[0].sections.every(section => section.household_id === secondHouseholdId)).toBe(true);
        });

        test('lists multiple fridges with their own sections and shared pantry', async () => {
            const mini = await initializeFridge({ name: 'Mini fridge', model_type: 'mini' });
            const sideBySide = await initializeFridge({ name: 'Garage fridge', model_type: 'side_by_side' });

            const res = await request(app)
                .get('/api/v1/fridges')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);

            const listedMini = res.body.find(fridge => fridge.id === mini.id);
            const listedSideBySide = res.body.find(fridge => fridge.id === sideBySide.id);
            const miniPhysicalSections = listedMini.sections.filter(section => section.fridge_id === mini.id);
            const sideBySidePhysicalSections = listedSideBySide.sections.filter(section => section.fridge_id === sideBySide.id);
            const miniPantry = listedMini.sections.find(section => section.section_key === 'pantry');
            const sideBySidePantry = listedSideBySide.sections.find(section => section.section_key === 'pantry');

            expect(miniPhysicalSections.map(section => section.section_key)).toEqual(['main']);
            expect(sideBySidePhysicalSections.map(section => section.section_key)).toEqual(['left', 'right']);
            expect(miniPantry.id).toBe(sideBySidePantry.id);
            expect(miniPantry.fridge_id).toBeNull();
        });
    });

    describe('GET /fridges/:id', () => {
        test('gets one fridge with its sections and pantry', async () => {
            const fridge = await initializeFridge({ name: 'Detail fridge', model_type: 'two_layered' });

            const res = await request(app)
                .get(`/api/v1/fridges/${fridge.id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.fridge.id).toBe(fridge.id);
            expect(res.body.fridge.name).toBe('Detail fridge');
            expect(res.body.fridge.sections.map(section => section.section_key)).toEqual(['upper', 'lower', 'pantry']);
            expect(res.body.fridge.sections.find(section => section.section_key === 'pantry').fridge_id).toBeNull();
        });

        test('returns 404 for a missing fridge', async () => {
            const res = await request(app)
                .get('/api/v1/fridges/99999999')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });

        test('returns 404 for another household fridge', async () => {
            const other = await signupAndGetToken('Other User');
            const otherFridge = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${other.token}`)
                .send({ name: 'Other fridge', model_type: 'mini' });

            const res = await request(app)
                .get(`/api/v1/fridges/${otherFridge.body.fridge.id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    describe('PATCH /fridges/:id', () => {
        test('renames a fridge and returns its sections', async () => {
            const fridge = await initializeFridge({ name: 'Old fridge name', model_type: 'mini' });

            const res = await request(app)
                .patch(`/api/v1/fridges/${fridge.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Kitchen fridge' });

            expect(res.status).toBe(200);
            expect(res.body.fridge.id).toBe(fridge.id);
            expect(res.body.fridge.name).toBe('Kitchen fridge');
            expect(res.body.fridge.sections.some(section => section.section_key === 'main')).toBe(true);
            expect(res.body.fridge.sections.some(section => section.section_key === 'pantry')).toBe(true);
        });

        test('rejects a blank fridge name', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });

            const res = await request(app)
                .patch(`/api/v1/fridges/${fridge.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: '' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('does not rename another household fridge', async () => {
            const other = await signupAndGetToken('Other User');
            const otherFridge = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${other.token}`)
                .send({ name: 'Other fridge', model_type: 'mini' });

            const res = await request(app)
                .patch(`/api/v1/fridges/${otherFridge.body.fridge.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Hijacked fridge' });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });

    describe('POST /items with storage sections', () => {
        test('places an item in a door-capable fridge section', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Milk',
                    storage_section_id: mainSection.id,
                    is_in_door: true,
                });

            expect(res.status).toBe(201);
            expect(res.body.item.fridge_id).toBe(fridge.id);
            expect(res.body.item.storage_section_id).toBe(mainSection.id);
            expect(res.body.item.storage).toBe('fridge door');
            expect(res.body.item.is_in_door).toBe(true);
        });

        test('rejects door placement in a section without door space', async () => {
            const fridge = await initializeFridge({ model_type: 'three_layered' });
            const middleSection = fridge.sections.find(section => section.section_key === 'middle');

            const res = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Yogurt',
                    storage_section_id: middleSection.id,
                    is_in_door: true,
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('rejects a storage section from another household', async () => {
            const other = await signupAndGetToken('Other User');
            const otherFridge = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${other.token}`)
                .send({ name: 'Other fridge', model_type: 'mini' });
            const otherSection = otherFridge.body.fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Borrowed shelf item',
                    storage_section_id: otherSection.id,
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('PATCH /items/:id with storage sections', () => {
        test('moves an existing item from one section to another', async () => {
            const fridge = await initializeFridge({ model_type: 'side_by_side' });
            const leftSection = fridge.sections.find(section => section.section_key === 'left');
            const rightSection = fridge.sections.find(section => section.section_key === 'right');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Chicken', storage_section_id: leftSection.id });

            const res = await request(app)
                .patch(`/api/v1/items/${created.body.item.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ storage_section_id: rightSection.id, is_in_door: true });

            expect(res.status).toBe(200);
            expect(res.body.item.fridge_id).toBe(fridge.id);
            expect(res.body.item.storage_section_id).toBe(rightSection.id);
            expect(res.body.item.storage).toBe('fridge door');
            expect(res.body.item.is_in_door).toBe(true);
        });

        test('moves an item back to broad storage without a section', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Milk', storage_section_id: mainSection.id, is_in_door: true });

            const res = await request(app)
                .patch(`/api/v1/items/${created.body.item.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ storage_section_id: null, storage: 'pantry' });

            expect(res.status).toBe(200);
            expect(res.body.item.fridge_id).toBeNull();
            expect(res.body.item.storage_section_id).toBeNull();
            expect(res.body.item.storage).toBe('pantry');
            expect(res.body.item.is_in_door).toBe(false);
        });

        test('toggles door placement for an existing section item', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Sauce', storage_section_id: mainSection.id });

            const res = await request(app)
                .patch(`/api/v1/items/${created.body.item.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ is_in_door: true });

            expect(res.status).toBe(200);
            expect(res.body.item.storage_section_id).toBe(mainSection.id);
            expect(res.body.item.storage).toBe('fridge door');
            expect(res.body.item.is_in_door).toBe(true);
        });

        test('rejects door placement when the current section has no door space', async () => {
            const fridge = await initializeFridge({ model_type: 'three_layered' });
            const middleSection = fridge.sections.find(section => section.section_key === 'middle');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Fish', storage_section_id: middleSection.id });

            const res = await request(app)
                .patch(`/api/v1/items/${created.body.item.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ is_in_door: true });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('PATCH /storage-sections/:id', () => {
        test('updates section details and reclassifies items in that section', async () => {
            const fridge = await initializeFridge({ model_type: 'side_by_side' });
            const fridgeSection = fridge.sections.find(section => section.section_key === 'right');
            const createdItem = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Ketchup',
                    storage_section_id: fridgeSection.id,
                    is_in_door: true,
                });

            expect(createdItem.status).toBe(201);

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${fridgeSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Converted freezer',
                    section_type: 'freezer',
                    has_door_space: false,
                });

            expect(res.status).toBe(200);
            expect(res.body.storage_section.name).toBe('Converted freezer');
            expect(res.body.storage_section.section_type).toBe('freezer');
            expect(res.body.storage_section.has_door_space).toBe(false);

            const item = await pool.query(
                `SELECT storage, is_in_door
                 FROM items
                 WHERE id = $1`,
                [createdItem.body.item.id]
            );
            expect(item.rows[0].storage).toBe('freezer');
            expect(item.rows[0].is_in_door).toBe(false);
        });

        test('updates only the section name when no type or door change is provided', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${mainSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Drink shelf' });

            expect(res.status).toBe(200);
            expect(res.body.storage_section.name).toBe('Drink shelf');
            expect(res.body.storage_section.section_type).toBe(mainSection.section_type);
            expect(res.body.storage_section.has_door_space).toBe(mainSection.has_door_space);
        });

        test('rejects a blank section name', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${mainSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: '' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('rejects an invalid section type', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${mainSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ section_type: 'countertop' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('renames the pantry section while keeping pantry items outside a fridge', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const pantrySection = fridge.sections.find(section => section.section_key === 'pantry');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Rice', storage_section_id: pantrySection.id });

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${pantrySection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Dry goods' });

            expect(res.status).toBe(200);
            expect(res.body.storage_section.name).toBe('Dry goods');
            expect(res.body.storage_section.fridge_id).toBeNull();

            const item = await pool.query(
                `SELECT fridge_id, storage_section_id, storage
                 FROM items
                 WHERE id = $1`,
                [created.body.item.id]
            );
            expect(item.rows[0].fridge_id).toBeNull();
            expect(item.rows[0].storage_section_id).toBe(pantrySection.id);
            expect(item.rows[0].storage).toBe('pantry');
        });

        test('keeps existing door items in the door when door space remains enabled', async () => {
            const fridge = await initializeFridge({ model_type: 'mini' });
            const mainSection = fridge.sections.find(section => section.section_key === 'main');
            const created = await request(app)
                .post('/api/v1/items')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Jam', storage_section_id: mainSection.id, is_in_door: true });

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${mainSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Sauce shelf', has_door_space: true });

            expect(res.status).toBe(200);

            const item = await pool.query(
                `SELECT storage, is_in_door
                 FROM items
                 WHERE id = $1`,
                [created.body.item.id]
            );
            expect(item.rows[0].storage).toBe('fridge');
            expect(item.rows[0].is_in_door).toBe(true);
        });

        test('does not update a section from another household', async () => {
            const other = await signupAndGetToken('Other User');
            const otherFridge = await request(app)
                .post('/api/v1/fridges/initialize')
                .set('Authorization', `Bearer ${other.token}`)
                .send({ name: 'Other fridge', model_type: 'mini' });
            const otherSection = otherFridge.body.fridge.sections.find(section => section.section_key === 'main');

            const res = await request(app)
                .patch(`/api/v1/storage-sections/${otherSection.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Not mine' });

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('NOT_FOUND');
        });
    });
});
