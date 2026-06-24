const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Codex UI bridge: the API contract documented this read endpoint, but the route was missing.
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

module.exports = router;
