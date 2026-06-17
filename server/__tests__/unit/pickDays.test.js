const { pickDays } = require('../../helpers/auto-expiry');

describe('pickDays', () => {
    // a catalog row with every storage filled in
    const row = { pantry_days: 30, fridge_days: 7, freezer_days: 180, default_storage: 'fridge' };

    test('reads freezer_days when storage is freezer', () => {
        expect(pickDays(row, 'freezer')).toBe(180);
    });

    test('reads pantry_days when storage is pantry', () => {
        expect(pickDays(row, 'pantry')).toBe(30);
    });

    test('reads fridge_days when storage is fridge', () => {
        expect(pickDays(row, 'fridge')).toBe(7);
    });

    // the implicit mapping cases: door & fresh zone are fridge compartments
    test('treats "fridge door" as fridge', () => {
        expect(pickDays(row, 'fridge door')).toBe(7);
    });

    test('treats "fresh zone" as fridge', () => {
        expect(pickDays(row, 'fresh zone')).toBe(7);
    });

    // edge cases
    test('returns null when row is null', () => {
        expect(pickDays(null, 'fridge')).toBe(null);
    });

    test('returns null when the chosen storage column is null', () => {
        // e.g. milk has no pantry shelf life
        const milk = { pantry_days: null, fridge_days: 5, freezer_days: 90 };
        expect(pickDays(milk, 'pantry')).toBe(null);
    });
});