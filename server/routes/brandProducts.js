const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { getHouseholdId } = require('../helpers/household');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const values = [householdId];
        let whereClause = '';

        if (req.query.food_type_id) {
            values.push(Number(req.query.food_type_id));
            whereClause = `AND food_type_id = $${values.length}`;
        }

        const result = await pool.query(
            `SELECT id, brand, food_type_id, default_storage, pantry_days, fridge_days, freezer_days, household_id
             FROM brand_products
             WHERE (household_id = $1 OR household_id IS NULL)
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
