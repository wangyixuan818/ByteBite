const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { formatDate, todayDate, addDays } = require('../helpers/date');
const { pickDays } = require('../helpers/auto-expiry');
const { getHouseholdId } = require('../helpers/household');
const { storageFromSection, getStorageSection } = require('../helpers/storage');

const router = express.Router();
router.use(reqAuth);

const itemSelectFields = `*,
                (expiry_date - CURRENT_DATE)::int AS days_until_expiry,
                (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) AS expired,
                CASE
                    WHEN expiry_date IS NULL THEN 'no_date'
                    WHEN (expiry_date - CURRENT_DATE)::int < 0 THEN 'expired'
                    WHEN (expiry_date - CURRENT_DATE)::int = 0 THEN 'expiring_today'
                    WHEN (expiry_date - CURRENT_DATE)::int <= 3 THEN 'expiring_soon'
                    WHEN (expiry_date - CURRENT_DATE)::int <= 7 THEN 'expiring_this_week'
                    ELSE 'ok'
                END AS expiry_status`;


router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        // add a tag to denote how many days they are from expiry
        const result = await pool.query(
            `SELECT ${itemSelectFields}
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
    storage_section_id: z.number().int().positive().optional(),
    is_in_door: z.boolean().optional(),
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
                quantity, unit, added_date, expiry_date, storage, storage_section_id, is_in_door } 
                    = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);

        // let added_date fall back to current date if not provided
        const finalAddedDate = added_date ?? todayDate();

        let resolvedExpiryDate = expiry_date ?? null;
        let expiryIsEstimated = false;
        let finalStorage = storage ?? null; // auto fall back if not defined
        let finalStorageSectionId = storage_section_id ?? null;
        let finalFridgeId = null;
        let finalIsInDoor = is_in_door ?? false;

        if (finalStorageSectionId) {
            const section = await getStorageSection(pool, householdId, finalStorageSectionId);
            if (!section) {
                return res.status(400).json({ error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid storage section',
                }});
            }
            if (finalIsInDoor && !section.has_door_space) {
                return res.status(400).json({ error: {
                    code: 'VALIDATION_ERROR',
                    message: 'This storage section has no door space',
                }});
            }
            finalFridgeId = section.fridge_id ?? null;
            finalStorage = storageFromSection(section.section_type, finalIsInDoor);
        }

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
        if (brand_product_id) {
            const r = await pool.query(
                `SELECT id, food_type_id, fridge_days, pantry_days, freezer_days, default_storage
                FROM brand_products
                WHERE id = $1 
                    AND (household_id = $2 OR household_id IS NULL)`,
                [brand_product_id, householdId]
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
            (household_id, fridge_id, storage_section_id, name, food_type_id, brand_product_id, category_id, initial_quantity, quantity, unit, added_date, expiry_date, expiry_is_estimated, storage, is_in_door, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id`,
            [householdId, finalFridgeId, finalStorageSectionId, name, matchedFoodTypeId, matchedBrandId, matchedCategoryId, quantity ?? null, unit ?? null, finalAddedDate,
                resolvedExpiryDate, expiryIsEstimated, finalStorage ?? null, finalIsInDoor, req.user.userId]
        );
        const itemRes = await pool.query(
            `SELECT ${itemSelectFields} FROM items WHERE id = $1`,
            [insertRes.rows[0].id]
        );
        return res.status(201).json({ item: itemRes.rows[0] });
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
            `SELECT ${itemSelectFields}
             FROM items
             WHERE id = $1 AND household_id = $2 AND status <> 'removed'`,
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
    storage_section_id: z.number().int().positive().nullable().optional(),
    is_in_door: z.boolean().optional(),
    status: z.enum(['active', 'consumed', 'disposed', 'removed']).optional(),
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

    const { name, food_type_id, brand_product_id, quantity, unit, added_date, expiry_date, storage, storage_section_id, is_in_door, status } = parsed.data;

    try {
        const householdId = await getHouseholdId(req.user.userId);
        const sectionProvided = Object.prototype.hasOwnProperty.call(parsed.data, 'storage_section_id');
        let finalStorageSectionId = storage_section_id;
        let finalFridgeId;
        let finalStorage = storage;
        let finalIsInDoor = is_in_door;

        if (sectionProvided && finalStorageSectionId) {
            const section = await getStorageSection(pool, householdId, finalStorageSectionId);
            if (!section) {
                return res.status(400).json({ error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid storage section',
                }});
            }
            const doorPlacement = finalIsInDoor ?? false;
            if (doorPlacement && !section.has_door_space) {
                return res.status(400).json({ error: {
                    code: 'VALIDATION_ERROR',
                    message: 'This storage section has no door space',
                }});
            }
            finalFridgeId = section.fridge_id ?? null;
            finalStorage = storageFromSection(section.section_type, doorPlacement);
            finalIsInDoor = doorPlacement;
        } else if (sectionProvided && finalStorageSectionId === null) {
            finalFridgeId = null;
            finalIsInDoor = false;
        } else if (finalIsInDoor !== undefined) {
            const current = await pool.query(
                `SELECT ss.id, ss.fridge_id, ss.section_type, ss.has_door_space
                 FROM items i
                 LEFT JOIN storage_sections ss ON ss.id = i.storage_section_id
                 WHERE i.id = $1 AND i.household_id = $2`,
                [req.params.id, householdId]
            );
            const section = current.rows[0];
            if (!section) {
                return res.status(404).json({ error: {
                    code: 'NOT_FOUND',
                    message: 'Item not found'
                }});
            }
            if (section.id && finalIsInDoor && !section.has_door_space) {
                return res.status(400).json({ error: {
                    code: 'VALIDATION_ERROR',
                    message: 'This storage section has no door space',
                }});
            }
            if (section.id) finalStorage = storageFromSection(section.section_type, finalIsInDoor);
        }

        const updates = [];
        const values = [];
        const addUpdate = (sql, value) => {
            values.push(value);
            updates.push(sql.replace('?', `$${values.length}`));
        };

        if (name !== undefined) addUpdate('name = ?', name);
        if (food_type_id !== undefined) addUpdate('food_type_id = ?', food_type_id);
        if (brand_product_id !== undefined) addUpdate('brand_product_id = ?', brand_product_id);
        if (quantity !== undefined) addUpdate('quantity = ?', quantity);
        if (unit !== undefined) addUpdate('unit = ?', unit);
        if (added_date !== undefined) addUpdate('added_date = ?', added_date);
        if (expiry_date !== undefined) {
            addUpdate('expiry_date = ?', expiry_date);
            updates.push('expiry_is_estimated = false');
        }
        if (finalStorage !== undefined) addUpdate('storage = ?', finalStorage);
        if (sectionProvided) {
            addUpdate('storage_section_id = ?', finalStorageSectionId);
            addUpdate('fridge_id = ?', finalFridgeId ?? null);
        }
        if (finalIsInDoor !== undefined) addUpdate('is_in_door = ?', finalIsInDoor);
        if (status !== undefined) {
            addUpdate('status = ?', status);
            updates.push(`status_updated_at = CASE WHEN $${values.length}::text IS DISTINCT FROM status THEN now() ELSE status_updated_at END`);
            updates.push(`consumed_at = CASE
                WHEN $${values.length}::text = 'consumed' THEN LEAST(CURRENT_DATE, COALESCE(expiry_date, CURRENT_DATE))
                WHEN $${values.length}::text = 'active' THEN NULL
                ELSE consumed_at
            END`);
            updates.push(`disposed_at = CASE
                WHEN $${values.length}::text = 'disposed' THEN CURRENT_DATE
                WHEN $${values.length}::text = 'active' THEN NULL
                ELSE disposed_at
            END`);
            updates.push(`removed_at = CASE
                WHEN $${values.length}::text = 'removed' THEN CURRENT_DATE
                WHEN $${values.length}::text = 'active' THEN NULL
                ELSE removed_at
            END`);
        }
        updates.push('updated_at = now()');
        values.push(req.params.id, householdId);

        const updateRes = await pool.query(
            `UPDATE items SET ${updates.join(', ')}
             WHERE id = $${values.length - 1} AND household_id = $${values.length}
             RETURNING id`,
            values
        );
        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: {
                code: 'NOT_FOUND',
                message: 'Item not found'
            }});
        }
        const itemRes = await pool.query(
            `SELECT ${itemSelectFields} FROM items WHERE id = $1`,
            [updateRes.rows[0].id]
        );
        return res.status(200).json({ item: itemRes.rows[0] });
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
            `UPDATE items
             SET status = 'removed',
                 status_updated_at = now(),
                 removed_at = CURRENT_DATE,
                 updated_at = now()
             WHERE id = $1 AND household_id = $2 AND status <> 'removed'
             RETURNING id`,
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
