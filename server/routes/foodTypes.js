const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { getHouseholdId } = require('../helpers/household');

const router = express.Router();
router.use(reqAuth);

router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const result = await pool.query(
            `SELECT id, name, category_id, default_storage,
                    pantry_days, fridge_days, freezer_days, household_id
            FROM food_types
            WHERE household_id = $1 OR household_id IS NULL
            ORDER BY name`,
            [householdId]
        );
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
        const householdId = await getHouseholdId(req.user.userId);
        
        // reuse an existing food type with the same name (public, or already in my household)
        const existing = await pool.query(
            `SELECT id, name, category_id, default_storage, pantry_days, fridge_days, freezer_days, household_id
             FROM food_types
             WHERE LOWER(name) = LOWER($1) AND (household_id IS NULL OR household_id = $2)
             ORDER BY household_id NULLS FIRST
             LIMIT 1`,
            [name.trim(), householdId]
        );
        if (existing.rows[0]) {
            return res.status(200).json({ food_type: existing.rows[0] });
        }

        const result = await pool.query(
            `INSERT INTO food_types
                (name, category_id, default_storage, pantry_days, fridge_days, freezer_days, household_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, name, category_id, default_storage, pantry_days, fridge_days, freezer_days, household_id`,
            [name.trim(), category_id, default_storage ?? null, pantry_days ?? null, fridge_days ?? null, freezer_days ?? null, householdId]
        );
        return res.status(201).json({ food_type: result.rows[0] });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({
                error: {
                    code: 'FOOD_TYPE_ALREADY_EXISTS',
                    message: 'This food type already exists'
                }
            });
        }
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

module.exports = router;
