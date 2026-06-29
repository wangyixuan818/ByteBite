const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertItem } = require('../helpers/items');
const { addDays, todayDate } = require('../../helpers/date');
const { createExpiryNotifications } = require('../../cron/expiry-alerts');

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await pool.end(); });


describe('GET /notifications', () => {

    test('requires authentication', async () => {
        const res = await request(app).get('/api/v1/notifications');
        expect(res.status).toBe(401);
    });

    test('returns this user\'s notifications', async () => {
        const { token, householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'Milk',
            expiry_date: addDays(todayDate(), 1) });
        await createExpiryNotifications();

        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].message).toMatch(/Milk/);
        expect(res.body[0].read_at).toBe(null);
    });

    test('does not return another user\'s notifications', async () => {
        // user A creates an item and gets a notification
        const a = await signupAndGetToken();
        await insertItem({ household_id: a.householdId, name: 'Milk',
            expiry_date: addDays(todayDate(), 1) });
        await createExpiryNotifications();

        // user B logs in fresh and should see nth
        const b = await signupAndGetToken();
        const res = await request(app)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${b.token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

});


describe('PATCH /notifications/:id', () => {

    // helper to set up: create one notification and return its id and the owner's token
    async function setupNotification() {
        const { token, householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'Milk',
            expiry_date: addDays(todayDate(), 1) });
        await createExpiryNotifications();
        const id = (await pool.query('SELECT id FROM notifications LIMIT 1')).rows[0].id;
        return { token, id };
    }

    test('marks a notification as read by setting read_at', async () => {
        const { token, id } = await setupNotification();

        const res = await request(app)
            .patch(`/api/v1/notifications/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ read: true });

        expect(res.status).toBe(200);
        expect(res.body.notification.read_at).not.toBe(null);
    });

    test('returns 404 for a nonexistent notification', async () => {
        const { token } = await setupNotification();

        const res = await request(app)
            .patch('/api/v1/notifications/99999999')
            .set('Authorization', `Bearer ${token}`)
            .send({ read: true });

        expect(res.status).toBe(404);
    });

    test('returns 404 for another user\'s notification (isolation)', async () => {
        const { id } = await setupNotification();
        const other = await signupAndGetToken();

        const res = await request(app)
            .patch(`/api/v1/notifications/${id}`)
            .set('Authorization', `Bearer ${other.token}`)
            .send({ read: true });

        expect(res.status).toBe(404);
    });

});