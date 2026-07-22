const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { getHouseholdId } = require('../helpers/household');
const { storageFromSection } = require('../helpers/storage');

const router = express.Router();
router.use(reqAuth);

const updateStorageSectionSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    section_type: z.enum(['fridge', 'freezer', 'fresh_zone', 'pantry']).optional(),
    has_door_space: z.boolean().optional(),
});

router.patch('/:id', async (req, res) => {
    const parsed = updateStorageSectionSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    const { name, section_type, has_door_space } = parsed.data;
    const client = await pool.connect();
    try {
        const householdId = await getHouseholdId(req.user.userId);
        await client.query('BEGIN');

        const sectionRes = await client.query(
            `UPDATE storage_sections
             SET name = COALESCE($1, name),
                 section_type = COALESCE($2, section_type),
                 has_door_space = COALESCE($3, has_door_space),
                 updated_at = now()
             WHERE id = $4 AND household_id = $5
             RETURNING id, household_id, fridge_id, name, section_type, section_key, position, has_door_space`,
            [name?.trim() ?? null, section_type ?? null, has_door_space ?? null, req.params.id, householdId]
        );
        const section = sectionRes.rows[0];
        if (!section) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Storage section not found' } });
        }

        const storage = storageFromSection(section.section_type, false);
        await client.query(
            `UPDATE items
             SET storage = $1,
                 is_in_door = CASE WHEN $2 = false THEN false ELSE is_in_door END,
                 updated_at = now()
             WHERE household_id = $3 AND storage_section_id = $4`,
            [storage, section.has_door_space, householdId, section.id]
        );

        await client.query('COMMIT');
        return res.status(200).json({ storage_section: section });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    } finally {
        client.release();
    }
});

module.exports = router;
