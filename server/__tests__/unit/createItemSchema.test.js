const { createItemSchema } = require('../../routes/items');

// scenarios to test:
// accepts just name
// accepts w all fields
// accepts w some field

// reject if no name
// reject if name field is empty string
// reject if quantity is negative
// reject if storage is not one of allowed places
// [maybe for later] reject if expiry date is before today

describe('createItemSchema', () => {

    // acceptance
    test('accepts a minimal valid input (just name)', () => {
        const input = { name: 'Tomato'};
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(true);
        expect(res.data).toEqual(input);
    });

    test('accepts full input', () => {
        const input = { name: 'Milk',
            food_type_id: 1,
            quantity: 1,
            unit: 'carton',
            expiry_date: '2026-06-21', // YYYY-MM-DD
            storage: 'fridge' };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(true);
        expect(res.data).toEqual(input);
    });

    test('accepts input with some optional fields', () => {
        const input = { name: 'Eggs',
            quantity: 2,
            unit: 'pieces' };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(true);
        expect(res.data).toEqual(input);
    });

    
    // rejections
    test('rejects input without name', () => {
        const input = { quantity: 1 };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(false);
    });

    test('rejects input with empty name', () => {
        const input = { name: '' };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(false);
    });

    test('rejects input with negative quantity', () => {
        const input = { name: 'Yogurt', quantity: -1 };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(false);
    });

    test('rejects input with invalid storage value', () => {
        const input = { name: 'Cheese', storage: 'cupboard' };
        const res = createItemSchema.safeParse(input);
        expect(res.success).toBe(false);
    });     

});