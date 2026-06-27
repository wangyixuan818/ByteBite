const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, default_storage, pantry_days, fridge_days, freezer_days
             FROM categories
             ORDER BY name`
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
        const result = await pool.query(
            `INSERT INTO categories(name, default_storage)
             VALUES($1, $2)
             RETURNING id, name, default_storage, pantry_days, fridge_days, freezer_days`,
             [name.trim(), default_storage]
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
