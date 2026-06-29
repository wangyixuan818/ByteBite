const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const values = [];
        let whereClause = '';

        if (req.query.food_type_id) {
            values.push(Number(req.query.food_type_id));
            whereClause = 'WHERE food_type_id = $1';
        }

        const result = await pool.query(
            `SELECT id, brand, food_type_id, default_storage, pantry_days, fridge_days, freezer_days
             FROM brand_products
             ${whereClause}
             ORDER BY brand`,
            values
        );

        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ 
            error: { 
                code: 'SERVER_ERROR', 
                message: 'Something went wrong' 
            }
        });
    }
});

module.exports = router;
