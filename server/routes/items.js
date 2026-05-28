const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');

const router = express.Router();
router.use(reqAuth);


async function getHouseholdId(userId) {
    const res = await pool.query(
        `SELECT household_id FROM user_household WHERE user_id = $1 LIMIT 1`,
        [userId]
    );
    return res.rows[0]?.household_id;
}

router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const result = await pool.query(
            `SELECT * FROM items WHERE household_id = $1 ORDER BY created_at DESC`,
            [householdId]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }
    });
    }
});

const createItemSchema = z.object({
    name: z.string().min(1),
    food_type_id: z.number().int().optional(),
    quantity: z.number().int().positive().optional(),
    unit: z.string().max(50).optional(),
    expiry_date: z.string().optional(), // YYYY-MM-DD
    storage: z.enum(['fridge', 'freezer', 'pantry']).optional(),
});

router.post('/', async (req, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: {
            code: 'VALIDATION_ERROR',
            message: msg
        }});
    }

    const { name, food_type_id, quantity, unit, expiry_date, storage } = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);
        const insertRes = await pool.query(
            `INSERT INTO items
            (household_id, name, food_type_id, quantity, unit, expiry_date, storage)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [householdId, name, food_type_id, quantity, unit, expiry_date, storage]
        );
        return res.status(201).json({ item: insertRes.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

module.exports = router;
