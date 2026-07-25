const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertItem } = require('../helpers/items');

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await pool.end(); });

// helper function to fetch rows of a given status for a household
async function rows(householdId, status) {
    const r = await pool.query(
        'SELECT id, quantity, status, consumed_at, disposed_at FROM items WHERE household_id = $1 AND status = $2',
        [householdId, status]
    );
    return r.rows;
}

describe('POST /items/:id/consume', () => {

    test('consumes the whole item when no quantity is given', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Eggs', quantity: 12 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.whole).toBe(true);
        expect((await rows(householdId, 'active')).length).toBe(0);
        const consumed = await rows(householdId, 'consumed');
        expect(consumed.length).toBe(1);
        expect(consumed[0].consumed_at).not.toBeNull();
    });

    test('splits the item on a partial consume', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Eggs', quantity: 12 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${token}`)
            .send({ quantity: 2 });

        expect(res.status).toBe(200);
        expect(res.body.whole).toBe(false);
        expect(Number(res.body.amount)).toBe(2);

        const active = await rows(householdId, 'active');
        const consumed = await rows(householdId, 'consumed');
        expect(Number(active[0].quantity)).toBe(10);    // 12 - 2
        expect(Number(consumed[0].quantity)).toBe(2);   // split-off portion
    });

    test('caps the amount at the available quantity', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Milk', quantity: 3 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${token}`)
            .send({ quantity: 100 });

        expect(res.status).toBe(200);
        expect(res.body.whole).toBe(true);
        expect(Number(res.body.amount)).toBe(3);
        expect((await rows(householdId, 'active')).length).toBe(0);
    });

    test('rejects a non-positive quantity', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Eggs', quantity: 12 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${token}`)
            .send({ quantity: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 404 for an item that is not active', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Eggs', quantity: 12, status: 'consumed' });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(404);
    });

    test('returns 404 for an item in another household', async () => {
        const owner = await signupAndGetToken();
        const item = await insertItem({ household_id: owner.householdId, name: 'Eggs', quantity: 12 });

        const other = await signupAndGetToken();
        const res = await request(app)
            .post(`/api/v1/items/${item.id}/consume`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({});

        expect(res.status).toBe(404);
    });
});

describe('POST /items/:id/dispose', () => {

    test('disposes the whole item and stamps disposed_at', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Bread', quantity: 1 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/dispose`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.whole).toBe(true);
        const disposed = await rows(householdId, 'disposed');
        expect(disposed.length).toBe(1);
        expect(disposed[0].disposed_at).not.toBeNull();
    });

    test('splits the item on a partial dispose', async () => {
        const { token, householdId } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Milk', quantity: 5 });

        const res = await request(app)
            .post(`/api/v1/items/${item.id}/dispose`)
            .set('Authorization', `Bearer ${token}`)
            .send({ quantity: 2 });

        expect(res.status).toBe(200);
        expect(res.body.whole).toBe(false);
        const active = await rows(householdId, 'active');
        const disposed = await rows(householdId, 'disposed');
        expect(Number(active[0].quantity)).toBe(3);    // 5 - 2
        expect(Number(disposed[0].quantity)).toBe(2);
    });
});