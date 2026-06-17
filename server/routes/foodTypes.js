const express = require('express');
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

module.exports = router;