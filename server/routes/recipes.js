const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/v1/recipes
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            // only returns {} instead of {null}
            // order by recipe id so the output is consistenet
            `SELECT
                r.*,
                COALESCE(
                    array_agg(rft.food_type_id ORDER BY rft.food_type_id)
                    FILTER ( WHERE rft.food_type_id IS NOT NULL), 
                    '{}'
                ) AS food_types_required
            FROM recipes r
            LEFT JOIN recipe_food_types rft
                ON r.id = rft.recipe_id
            GROUP BY r.id
            ORDER BY r.id`
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'An unexpected error occurred'
            }
    });
    }
});

// GET /api/v1/recipes/:id
router.get('/:id', async (req, res) => {
    // TODO: Validate that id is a positive integer.
    // TODO: Query one recipe and aggregate its food_types_required array.
    // TODO: Return { recipe } on success.
    // TODO: Return the documented NOT_FOUND error if no recipe has this id.
    try {
        // Codex UI bridge: fix parameter and table names so the existing detail screen can load.
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Recipe does not exist',
                }
            });
        }

        const result = await pool.query(
            `SELECT
                r.*,
                COALESCE(
                    array_agg(rft.food_type_id ORDER BY rft.food_type_id)
                    FILTER (WHERE rft.food_type_id IS NOT NULL),
                    '{}'
                ) AS food_types_required
            FROM recipes r
            LEFT JOIN recipe_food_types rft
                ON r.id = rft.recipe_id
            WHERE r.id = $1
            GROUP BY r.id`,
            [ id ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Recipe does not exist',
                }
            });
        } 

        return res.status(200).json({ recipe: result.rows[0] });
    } catch (err) {
        console.error(err);
        
        return res.status(500).json({
        error: {
            code: 'SERVER_ERROR',
            message: 'An unexpected error occurred',
        },
    });
    }
    
});

module.exports = router;
