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
    storage: z.enum(['fridge', 'freezer', 'pantry', 'fridge door', 'fresh zone']).optional(),
});



// creating items
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

        // inserting the automatic expiry logic here
        let resolvedExpiryDate = expiry_date ?? null;
        let expiryIsEstimated = false;

        if (!resolvedExpiryDate) {
            // if no expiry date provided this will try to estimate based on food type
            let shelfLifeDays = null;

            if (food_type_id) {
                // query the food type's average shelf life if it exists in the database
                const foodTypeRes = await pool.query(
                    `SELECT default_shelf_life_days FROM food_types WHERE id = $1`,
                    [food_type_id]
                );
                shelfLifeDays = foodTypeRes.rows[0]?.default_shelf_life_days; 
            }
        }

        if (!shelfLifeDays && name) { // try to search by name
            // look for partial match as well but prioritise exact match first
            const foodTypeRes = await pool.query(
                `SELECT default_shelf_life_days 
                FROM food_types 
                WHERE name ILIKE '%' || $1 || '%'
                ORDER BY
                    CASE
                        WHEN LOWER(name) = LOWER($1) THEN 1            -- exact match gets highest priority
                        WHEN LOWER(name) LIKE '%' || LOWER($1) || '%' THEN 2   
                                        -- partial match gets second priority; %word% finds all match of word
                        ELSE 3
                    END
                LIMIT 1`, // limit 1 to faster a bit
                [name]
            );
            shelfLifeDays = foodTypeRes.rows[0]?.default_shelf_life_days;
        }

        if (shelfLifeDays) {
            const now = new Date();
            now.setDate(now.getDate() + shelfLifeDays);
            resolvedExpiryDate = now.toISOString().split('T')[0];     // converts to YYYYMMDD format, matching item database
            expiryIsEstimated = true;   // set flag to true
        }

        // end of automatic expiry logic

        

        const insertRes = await pool.query(
            `INSERT INTO items
            (household_id, name, food_type_id, quantity, unit, expiry_date, expiry_is_estimated, storage, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [householdId, name, food_type_id ?? null, quantity ?? null, unit ?? null, 
                resolvedExpiryDate, expiryIsEstimated, storage ?? null, req.user.userId] // updated to resolvedExpiryDate and included flag for estimated expiry
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


// reading items
router.get('/:id', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const itemRes = await pool.query(
            `SELECT * FROM items WHERE id = $1 AND household_id = $2`,
            [req.params.id, householdId]
        );
        const item = itemRes.rows[0];
        if (!item) {
            return res.status(404).json({ error: {
                code: 'NOT_FOUND',
                message: 'Item not found'
            }});
        }
        return res.status(200).json(item);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});


// updating items
const updateItemSchema = z.object({
    name: z.string().min(1).optional(),
    food_type_id: z.number().int().optional(),
    quantity: z.number().int().positive().optional(),
    unit: z.string().max(50).optional(),
    expiry_date: z.string().optional(),
    storage: z.enum(['fridge', 'freezer', 'pantry', 'fridge door', 'fresh zone']).optional(),
    status: z.enum(['active', 'consumed', 'removed', 'expired']).optional(),
});


router.patch('/:id', async (req, res) => {
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: {
            code: 'VALIDATION_ERROR',
            message: msg
        }});
    }

    const { name, food_type_id, quantity, unit, expiry_date, storage, status } = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);
        const updateRes = await pool.query(
            `UPDATE items SET
            name = COALESCE($1, name),
            food_type_id = COALESCE($2, food_type_id),
            quantity = COALESCE($3, quantity),
            unit = COALESCE($4, unit),
            expiry_date = COALESCE($5, expiry_date),
            expiry_is_estimated = CASE WHEN $5::date IS NOT NULL THEN false ELSE expiry_is_estimated END,   --if this update adds a expiry date, then it will update the estimation flag to false
            storage = COALESCE($6, storage),
            status = COALESCE($7, status)
            WHERE id = $8 AND household_id = $9
            RETURNING *`,
            [name ?? null, food_type_id ?? null, quantity ?? null, unit ?? null, expiry_date ?? null, 
                storage ?? null, status ?? null, req.params.id, householdId]
        );
        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: {
                code: 'NOT_FOUND',
                message: 'Item not found'
            }});
        }
        return res.status(200).json({ item: updateRes.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const deleteRes = await pool.query(
            `DELETE FROM items WHERE id = $1 AND household_id = $2 RETURNING *`,
            [req.params.id, householdId]
        );
        if (deleteRes.rows.length === 0) {
            return res.status(404).json({ error: {
                code: 'NOT_FOUND',
                message: 'Item not found'
            }});
        }
        return res.status(204).end();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

module.exports = router;
