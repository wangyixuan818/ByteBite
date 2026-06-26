const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');

const router = express.Router();
router.use(reqAuth);

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, category_id, default_storage,
                    pantry_days, fridge_days, freezer_days
            FROM food_types 
            ORDER BY name`);
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }}); 
    }
});

const createFoodTypeSchema = z.object({
    name: z.string().min(1),
    category_id: z.number().int().positive(),
    default_storage: z.enum(['fridge', 'freezer', 'pantry', 'fridge door', 'fresh zone']).optional(),
    pantry_days: z.number().int().nonnegative().nullable().optional(),
    fridge_days: z.number().int().nonnegative().nullable().optional(),
    freezer_days: z.number().int().nonnegative().nullable().optional(),
});

router.post('/', async (req, res) => {
    const parsed = createFoodTypeSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: {
            code: 'VALIDATION_ERROR',
            message: msg
        }});
    }

    const { name, category_id, default_storage, pantry_days, fridge_days, freezer_days } = parsed.data;

    try {
        const result = await pool.query(
            `INSERT INTO food_types
                (name, category_id, default_storage, pantry_days, fridge_days, freezer_days)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, category_id, default_storage, pantry_days, fridge_days, freezer_days`,
            [name.trim(), category_id, default_storage ?? null, pantry_days ?? null, fridge_days ?? null, freezer_days ?? null]
        );
        return res.status(201).json({ food_type: result.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

module.exports = router;
