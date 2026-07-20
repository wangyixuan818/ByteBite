const pool = require('../../db');
const { cleanDatabase } = require('../helpers/db');
const { signupAndGetToken } = require('../helpers/auth');
const { insertItem } = require('../helpers/items');
const { addDays, todayDate } = require('../../helpers/date');
const { markExpiredItems, createExpiryNotifications } = require('../../cron/expiry-alerts');

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await pool.end(); });


describe('markExpiredItems', () => {

    test('does not mutate active items whose expiry_date is in the past', async () => {
        const { householdId } = await signupAndGetToken();
        const past = await insertItem({ household_id: householdId, name: 'Old milk',
            expiry_date: addDays(todayDate(), -1), status: 'active' });

        const count = await markExpiredItems();
        expect(count).toBe(0);

        const row = (await pool.query('SELECT status FROM items WHERE id = $1', [past.id])).rows[0];
        expect(row.status).toBe('active');
    });

    test('does NOT touch items expiring today (strictly past only)', async () => {
        const { householdId } = await signupAndGetToken();
        const today = await insertItem({ household_id: householdId, name: 'Today milk',
            expiry_date: todayDate(), status: 'active' });

        await markExpiredItems();
        const row = (await pool.query('SELECT status FROM items WHERE id = $1', [today.id])).rows[0];
        expect(row.status).toBe('active');
    });

    test('does NOT touch items already consumed/removed', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'eaten',
            expiry_date: addDays(todayDate(), -5), status: 'consumed' });

        const count = await markExpiredItems();
        expect(count).toBe(0);
    });

    test('does NOT touch items with no expiry_date', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'mystery',
            expiry_date: null, status: 'active' });

        const count = await markExpiredItems();
        expect(count).toBe(0);
    });

});


describe('createExpiryNotifications', () => {

    test('creates an "expiring_today" notification for an item expiring today', async () => {
        const { householdId, user } = await signupAndGetToken();
        const item = await insertItem({ household_id: householdId, name: 'Milk',
            expiry_date: todayDate() });

        await createExpiryNotifications();

        const notif = (await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1', [user.id])).rows[0];
        expect(notif).toBeDefined();
        expect(notif.type).toBe('expiring_today');
        expect(notif.item_id).toBe(item.id);
        expect(notif.message).toMatch(/Milk/);
    });

    test('creates an "expiring_soon" notification for items 1–3 days out', async () => {
        const { householdId, user } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'Yogurt',
            expiry_date: addDays(todayDate(), 2) });

        await createExpiryNotifications();

        const notif = (await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1', [user.id])).rows[0];
        expect(notif.type).toBe('expiring_soon');
    });

    test('does NOT create notifications for items more than 3 days away', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'Eggs',
            expiry_date: addDays(todayDate(), 5) });

        await createExpiryNotifications();
        const count = (await pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
        expect(count).toBe(0);
    });

    test('does NOT create notifications for already-expired items', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'old',
            expiry_date: addDays(todayDate(), -1) });

        await createExpiryNotifications();
        const count = (await pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
        expect(count).toBe(0);
    });

    test('does NOT create notifications for non-active items', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'consumed-yogurt',
            expiry_date: addDays(todayDate(), 1), status: 'consumed' });

        await createExpiryNotifications();
        const count = (await pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
        expect(count).toBe(0);
    });

    // the uniqueness constraint should make a second run on the same day a no-op
    test('running twice in the same day does not create duplicates', async () => {
        const { householdId } = await signupAndGetToken();
        await insertItem({ household_id: householdId, name: 'Cheese',
            expiry_date: addDays(todayDate(), 2) });

        await createExpiryNotifications();
        await createExpiryNotifications();

        const count = (await pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
        expect(count).toBe(1);
    });

});
