const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { formatDate, todayDate, addDays } = require('../helpers/date');
const { pickDays } = require('../helpers/auto-expiry');
const { getHouseholdId } = require('../helpers/household');

const router = express.Router();
router.use(reqAuth);


router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        // add a tag to denote how many days they are from expiry
        const result = await pool.query(
            `SELECT *,
                (expiry_date - CURRENT_DATE)::int AS days_until_expiry,
                CASE
                    WHEN expiry_date IS NULL THEN 'no_date'
                    WHEN (expiry_date - CURRENT_DATE)::int < 0 THEN 'expired'
                    WHEN (expiry_date - CURRENT_DATE)::int = 0 THEN 'expiring_today'
                    WHEN (expiry_date - CURRENT_DATE)::int <= 3 THEN 'expiring_soon'
                    WHEN (expiry_date - CURRENT_DATE)::int <= 7 THEN 'expiring_this_week'
                    ELSE 'ok'
                END AS expiry_status
            FROM items
            WHERE household_id = $1 AND status = 'active'
            ORDER BY
                expiry_date ASC NULLS LAST,
                created_at DESC`,
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

    // ids
    food_type_id: z.number().int().positive().optional(),
    brand_product_id: z.number().int().positive().optional(),
    category_id: z.number().int().positive().optional(),
    brand: z.string().optional(),

    // standard deets
    quantity: z.number().int().positive().optional(),
    unit: z.string().max(50).optional(),
    added_date: z.string().optional(), // YYYY-MM-DD
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

    const { name, 
                food_type_id, brand_product_id, category_id, brand,
                quantity, unit, added_date, expiry_date, storage } 
                    = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);

        // let added_date fall back to current date if not provided
        const finalAddedDate = added_date ?? todayDate();

        let resolvedExpiryDate = expiry_date ?? null;
        let expiryIsEstimated = false;
        let finalStorage = storage ?? null; // auto fall back if not defined

        // estimated expiry duration
        let shelfLifeDays = null;
        // default storage location
        let catalogStorage = null;

        // flags
        let matchedBrandId = brand_product_id ?? null;
        let matchedFoodTypeId = food_type_id ?? null;
        let matchedCategoryId = category_id ?? null;

        // Resolve typed brand text 0 --> brand_products row
        // Runs regardless of whether an expiry date was provided, so the brand is never silently dropped
        // foreign/invalid brand_product_id is always scrubbed before insert
        let brandShelfRow = null;
        if (brand && food_type_id && !brand_product_id) {
            const r = await pool.query(
                `SELECT id, fridge_days, pantry_days, freezer_days, default_storage
                FROM brand_products
                WHERE food_type_id = $1 AND LOWER(brand) = LOWER($2)
                    AND (household_id = $3 OR household_id IS NULL)`,
                [food_type_id, brand, householdId]
            );
            if (r.rows[0]) {
                brandShelfRow = r.rows[0];
                matchedBrandId = r.rows[0].id;
                matchedFoodTypeId = r.rows[0].food_type_id;
            } else {
                matchedBrandId = null; 
            }
        } else if (brand && food_type_id) {
            const r = await pool.query(
                `SELECT id, fridge_days, pantry_days, freezer_days, default_storage
                FROM brand_products
                WHERE food_type_id = $1 AND LOWER(brand) = LOWER($2)
                    AND (household_id = $3 OR household_id IS NULL)`,
                [food_type_id, brand, householdId]
            );
            if (r.rows[0]) {
                brandShelfRow = r.rows[0];
                matchedBrandId = r.rows[0].id;
            } else {
                // new brand for this food type --> create as private to this household
                const created = await pool.query(
                        `INSERT INTO brand_products (brand, food_type_id, household_id)
                        VALUES ($1, $2, $3)
                        RETURNING id`,
                        [brand.trim(), food_type_id, householdId]
                    );
                    matchedBrandId = created.rows[0].id;
                }
            }

        // inserting the automatic expiry logic here 
        // runs only if no expiry date added
        if (!resolvedExpiryDate) {
            // reuse the brand row found during brand resolution (id or text), if any
            let shelfLifeRow = brandShelfRow; // stores entire row retrieved

            // path 1: explicit IDs given --> removed in M3 as it is moved outside
            /* if (brand_product_id) {
                // go straight to lowest lvl query
                const r = await pool.query(
                    `SELECT fridge_days, pantry_days, freezer_days, default_storage, food_type_id
                    FROM brand_products
                    WHERE id = $1 AND (household_id = $2 OR household_id IS NULL)`,
                    [brand_product_id, householdId]
                );
                if (r.rows[0]) {
                    shelfLifeRow = r.rows[0];
                    matchedBrandId = brand_product_id;
                    matchedFoodTypeId = r.rows[0].food_type_id;
                } else {
                    matchedBrandId = null;
                }
            } */ 

            // path 2: User picked a product, maybe with a brand text
            if (!shelfLifeRow && food_type_id) {
                // lowest lvl: check if there is a brand variant matching the typed brand
                /* if (brandShelfRow) {
                    shelfLifeRow = brandShelfRow;
                } */ // removed in M3 as it is moved outside

                // otherwise we just use the product itself
                if (!shelfLifeRow) {
                    const ftRes = await pool.query(
                        `SELECT category_id, fridge_days, pantry_days, freezer_days, default_storage
                        FROM food_types WHERE id = $1`,
                        [food_type_id]
                    );   
                    if (ftRes.rows[0]) {
                        shelfLifeRow = ftRes.rows[0];
                        matchedFoodTypeId = food_type_id;
                        matchedCategoryId = ftRes.rows[0].category_id;  // just capture it if exist

                        // check if this food type has expiry duration for storage:
                        if (pickDays(ftRes.rows[0], finalStorage ?? ftRes.rows[0].default_storage) === null 
                            && ftRes.rows[0].category_id) {
                            const c = await pool.query(
                                `SELECT fridge_days, pantry_days, freezer_days, default_storage
                                FROM categories WHERE id = $1`,
                                [ftRes.rows[0].category_id]
                            );
                            if (c.rows[0]) shelfLifeRow = c.rows[0]; 
                        }
                    }
                }
            }

            // Path 3: user only gave a category
            if (!shelfLifeRow && category_id) {
                const r = await pool.query(
                    `SELECT fridge_days, pantry_days, freezer_days, default_storage
                    FROM categories WHERE id = $1`,
                    [category_id]
                );
                if (r.rows[0]) {
                    shelfLifeRow = r.rows[0];
                } else {
                    matchedCategoryId = null;   // bad id, discard it
                }
            }



            // path 4: only string text given, no explicit brand or category indicated
            // most flexible search
            if (!shelfLifeRow) {
                // lowest tier first: try to match a brand_product
                const brandRes = await pool.query(
                    // reverse to check if the row contains this item i am searching for
                    `SELECT bp.id, bp.food_type_id, bp.fridge_days, bp.pantry_days, bp.freezer_days, bp.default_storage
                    FROM brand_products bp
                    JOIN food_types ft ON ft.id = bp.food_type_id
                    WHERE $1 ILIKE '%' || bp.brand || '%' AND $1 ILIKE '%' || ft.name || '%'
                        AND (bp.household_id = $2 OR bp.household_id IS NULL)
                        AND (ft.household_id = $2 OR ft.household_id IS NULL)
                    LIMIT 1`,
                    [name, householdId]
                );

                if (brandRes.rows[0]) {
                    const row = brandRes.rows[0];
                    shelfLifeRow = row;
                    matchedBrandId = row.id;
                    matchedFoodTypeId = row.food_type_id;
                    matchedCategoryId = row.category_id;
                }

                // second tier: fall back to food_type match (product level)
                if (!shelfLifeRow) {
                    const ftRes = await pool.query(
                        `SELECT id, category_id, fridge_days, pantry_days, freezer_days, default_storage
                        FROM food_types
                        WHERE $1 ILIKE '%' || name || '%'
                            AND (household_id = $2 OR household_id IS NULL)
                        ORDER BY LENGTH(name) DESC
                        LIMIT 1`,
                        [name, householdId]
                    );

                    if (ftRes.rows[0]) {
                        const row = ftRes.rows[0];
                        shelfLifeRow = row;
                        matchedFoodTypeId = row.id;
                        matchedCategoryId = row.category_id;

                        // if product had no days for this storage, fall back to its category
                        if (pickDays(row, finalStorage ?? row.default_storage) === null && row.category_id) {
                            const catRes = await pool.query(
                                `SELECT fridge_days, pantry_days, freezer_days, default_storage
                                FROM categories WHERE id = $1
                                    AND (household_id = $2 OR household_id IS NULL)
                                `,
                                [row.category_id, householdId]
                            );
                            if (catRes.rows[0]) {
                                shelfLifeRow = catRes.rows[0];
                            }
                        }
                    }
                }
            }

            if (shelfLifeRow && shelfLifeDays === null) {
                catalogStorage = catalogStorage ?? shelfLifeRow.default_storage;
                shelfLifeDays = pickDays(shelfLifeRow, finalStorage ?? catalogStorage);
            }
        }

        if (!finalStorage) finalStorage = catalogStorage;

        // Compute the expiry date
        if (shelfLifeDays !== null) {
            resolvedExpiryDate = addDays(finalAddedDate, shelfLifeDays);
            expiryIsEstimated = true;
        }

        // end of automatic expiry logic



        const insertRes = await pool.query(
            `INSERT INTO items
            (household_id, name, food_type_id, brand_product_id, category_id, quantity, unit, added_date, expiry_date, expiry_is_estimated, storage, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)  
            RETURNING *`,
            [householdId, name, matchedFoodTypeId, matchedBrandId, matchedCategoryId, quantity ?? null, unit ?? null, finalAddedDate,
                resolvedExpiryDate, expiryIsEstimated, finalStorage ?? null, req.user.userId]
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
        return res.status(200).json({ item });
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
    brand_product_id: z.number().int().positive().nullable().optional(),
    quantity: z.number().int().positive().optional(),
    unit: z.string().max(50).optional(),
    added_date: z.string().optional(),
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

    const { name, food_type_id, brand_product_id, quantity, unit, added_date, expiry_date, storage, status } = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);
        const updateRes = await pool.query(
            `UPDATE items SET
                name = COALESCE($1, name),
                food_type_id = COALESCE($2, food_type_id),
                brand_product_id = COALESCE($3, brand_product_id),
                quantity = COALESCE($4, quantity),
                unit = COALESCE($5, unit),
                added_date = COALESCE($6, added_date),
                expiry_date = COALESCE($7, expiry_date),
                expiry_is_estimated = CASE WHEN $7::date IS NOT NULL THEN false ELSE expiry_is_estimated END,   --if this update adds a expiry date, then it will update the estimation flag to false
                storage = COALESCE($8, storage),
                status = COALESCE($9, status),
                updated_at = now()
            WHERE id = $10 AND household_id = $11
            RETURNING *`,
            [name ?? null, food_type_id ?? null, brand_product_id ?? null, quantity ?? null, unit ?? null, added_date ?? null, expiry_date ?? null,
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
module.exports.createItemSchema = createItemSchema;
module.exports.updateItemSchema = updateItemSchema;
