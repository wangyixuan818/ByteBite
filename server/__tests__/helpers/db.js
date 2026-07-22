// to help clean up the database in between tests
const pool = require('../../db');

// delete in reverse order of dependencies (so that we dont have foreign key constraint issues)
async function cleanDatabase() {
    await pool.query(`
        DO $$
        BEGIN
            IF to_regclass('public.recipe_food_types') IS NOT NULL THEN
                DELETE FROM recipe_food_types;
            END IF;

            IF to_regclass('public.recipes') IS NOT NULL THEN
                DELETE FROM recipes;
            END IF;
        END $$;
    `);
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM items');
    await pool.query(`
        DO $$
        BEGIN
            IF to_regclass('public.storage_sections') IS NOT NULL THEN
                DELETE FROM storage_sections;
            END IF;

            IF to_regclass('public.fridges') IS NOT NULL THEN
                DELETE FROM fridges;
            END IF;
        END $$;
    `);
    await pool.query('DELETE FROM brand_products');
    await pool.query('DELETE FROM food_types');
    await pool.query('DELETE FROM categories');
    await pool.query('DELETE FROM user_household');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM households');
}
// catalog tables are wiped too 
// each test seeds the exact rows it needs

module.exports = { cleanDatabase };
