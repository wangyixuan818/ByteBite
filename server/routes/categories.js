const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { getHouseholdId } = require('../helpers/household');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const result = await pool.query(
            `SELECT id, name, default_storage, pantry_days, fridge_days, freezer_days, household_id
             FROM categories
             WHERE household_id = $1 OR household_id IS NULL
             ORDER BY name`,
            [householdId]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.post('/', async(req, res) => {
    const { name, default_storage = 'fridge' } = req.body;

    if (!name || !name.trim()){
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Category name is required',
            }
        });
    }

    if (!['fridge', 'freezer', 'pantry', 'fridge door', 'fresh zone'].includes(default_storage)) {
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid default storage',
            }
        });
    }

    try {
        const householdId = await getHouseholdId(req.user.userId);
        // reuse an existing category with the same name (public, or already in my household)
        const existing = await pool.query(
            `SELECT id, name, default_storage, pantry_days, fridge_days, freezer_days, household_id
             FROM categories
             WHERE LOWER(name) = LOWER($1) AND (household_id IS NULL OR household_id = $2)
             ORDER BY household_id NULLS FIRST
             LIMIT 1`,
            [name.trim(), householdId]
        );
        if (existing.rows[0]) {
            return res.status(200).json({ category: existing.rows[0] });
        }
        const result = await pool.query(
            `INSERT INTO categories(name, default_storage, household_id)
             VALUES($1, $2, $3)
             RETURNING id, name, default_storage, pantry_days, fridge_days, freezer_days, household_id`,
             [name.trim(), default_storage, householdId]
        );

        return res.status(201).json({
            category: result.rows[0]
        });
    } catch(err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({
                error: {
                    code: 'CATEGORY_ALREADY_EXISTS',
                    message: 'This category already exists'
                }
            });
        }
        return res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Something went wrong'
            }
        });
    }
});

module.exports = router;
