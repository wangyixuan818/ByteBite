const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { getHouseholdId } = require('../helpers/household');
const { storageFromSection } = require('../helpers/storage');

const router = express.Router();
router.use(reqAuth);

const MODEL_DEFAULTS = {
    two_layered: [
        { section_key: 'upper', name: 'Upper freezer', section_type: 'freezer', has_door_space: true },
        { section_key: 'lower', name: 'Lower fridge', section_type: 'fridge', has_door_space: true },
    ],
    three_layered: [
        { section_key: 'upper', name: 'Upper fridge', section_type: 'fridge', has_door_space: true },
        { section_key: 'middle', name: 'Middle fresh zone', section_type: 'fresh_zone', has_door_space: false },
        { section_key: 'lower', name: 'Lower freezer', section_type: 'freezer', has_door_space: false },
    ],
    mini: [
        { section_key: 'main', name: 'Main fridge', section_type: 'fridge', has_door_space: true },
    ],
    side_by_side: [
        { section_key: 'left', name: 'Left freezer', section_type: 'freezer', has_door_space: true },
        { section_key: 'right', name: 'Right fridge', section_type: 'fridge', has_door_space: true },
    ],
};

const sectionSchema = z.object({
    section_key: z.string().min(1).max(50),
    name: z.string().min(1).max(80).optional(),
    section_type: z.enum(['fridge', 'freezer', 'fresh_zone']),
    has_door_space: z.boolean().optional(),
});

const initializeFridgeSchema = z.object({
    name: z.string().min(1).max(80),
    model_type: z.enum(['two_layered', 'three_layered', 'mini', 'side_by_side']),
    sections: z.array(sectionSchema).min(1).optional(),
});

function mergeWithDefaults(modelType, customSections = null) {
    const defaults = MODEL_DEFAULTS[modelType];
    if (!customSections) return defaults;

    const defaultByKey = new Map(defaults.map(section => [section.section_key, section]));
    return customSections.map((section, index) => {
        const base = defaultByKey.get(section.section_key) ?? {};
        return {
            ...base,
            ...section,
            name: section.name ?? base.name ?? section.section_key,
            has_door_space: section.has_door_space ?? base.has_door_space ?? true,
            position: index,
        };
    });
}

async function ensurePantrySection(client, householdId) {
    const existing = await client.query(
        `SELECT id, household_id, fridge_id, name, section_type, section_key, position, has_door_space
         FROM storage_sections
         WHERE household_id = $1 AND fridge_id IS NULL AND section_key = 'pantry'
         LIMIT 1`,
        [householdId]
    );
    if (existing.rows[0]) return existing.rows[0];

    const created = await client.query(
        `INSERT INTO storage_sections
            (household_id, fridge_id, name, section_type, section_key, position, has_door_space)
         VALUES ($1, NULL, 'Pantry', 'pantry', 'pantry', 999, false)
         RETURNING id, household_id, fridge_id, name, section_type, section_key, position, has_door_space`,
        [householdId]
    );
    return created.rows[0];
}

async function fetchFridge(client, householdId, fridgeId) {
    const fridgeRes = await client.query(
        `SELECT id, household_id, name, model_type, created_by, created_at, updated_at
         FROM fridges
         WHERE id = $1 AND household_id = $2`,
        [fridgeId, householdId]
    );
    const fridge = fridgeRes.rows[0];
    if (!fridge) return null;

    const sections = await client.query(
        `SELECT id, household_id, fridge_id, name, section_type, section_key, position, has_door_space
         FROM storage_sections
         WHERE household_id = $1 AND (fridge_id = $2 OR fridge_id IS NULL)
         ORDER BY fridge_id NULLS LAST, position, id`,
        [householdId, fridgeId]
    );
    return { ...fridge, sections: sections.rows };
}

async function mapExistingItems(client, householdId, fridgeId, sections, pantrySection) {
    const firstByType = new Map();
    for (const section of sections) {
        if (!firstByType.has(section.section_type)) firstByType.set(section.section_type, section);
    }

    const mappings = [
        { storage: 'fridge', section: firstByType.get('fridge'), isInDoor: false },
        { storage: 'freezer', section: firstByType.get('freezer'), isInDoor: false },
        { storage: 'fresh zone', section: firstByType.get('fresh_zone') ?? firstByType.get('fridge'), isInDoor: false },
        { storage: 'fridge door', section: firstByType.get('fridge'), isInDoor: true },
        { storage: 'pantry', section: pantrySection, isInDoor: false },
    ];

    let mappedCount = 0;
    for (const mapping of mappings) {
        if (!mapping.section) continue;
        const itemFridgeId = mapping.section.fridge_id ? fridgeId : null;
        const storage = storageFromSection(mapping.section.section_type, mapping.isInDoor);
        const result = await client.query(
            `UPDATE items
             SET fridge_id = $1,
                 storage_section_id = $2,
                 is_in_door = $3,
                 storage = $4,
                 updated_at = now()
             WHERE household_id = $5
               AND storage_section_id IS NULL
               AND storage = $6
             RETURNING id`,
            [itemFridgeId, mapping.section.id, mapping.isInDoor, storage, householdId, mapping.storage]
        );
        mappedCount += result.rowCount;
    }
    return mappedCount;
}

router.get('/', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const fridges = await pool.query(
            `SELECT id, household_id, name, model_type, created_by, created_at, updated_at
             FROM fridges
             WHERE household_id = $1
             ORDER BY created_at DESC`,
            [householdId]
        );
        const sections = await pool.query(
            `SELECT id, household_id, fridge_id, name, section_type, section_key, position, has_door_space
             FROM storage_sections
             WHERE household_id = $1
             ORDER BY fridge_id NULLS LAST, position, id`,
            [householdId]
        );
        const sectionsByFridge = new Map();
        for (const section of sections.rows) {
            const key = section.fridge_id ?? 'pantry';
            if (!sectionsByFridge.has(key)) sectionsByFridge.set(key, []);
            sectionsByFridge.get(key).push(section);
        }
        return res.status(200).json(fridges.rows.map(fridge => ({
            ...fridge,
            sections: [
                ...(sectionsByFridge.get(fridge.id) ?? []),
                ...(sectionsByFridge.get('pantry') ?? []),
            ],
        })));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const householdId = await getHouseholdId(req.user.userId);
        const fridge = await fetchFridge(pool, householdId, req.params.id);
        if (!fridge) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fridge not found' } });
        return res.status(200).json({ fridge });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.post('/initialize', async (req, res) => {
    const parsed = initializeFridgeSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    const { name, model_type, sections: customSections } = parsed.data;
    const sectionsToCreate = mergeWithDefaults(model_type, customSections);
    const client = await pool.connect();

    try {
        const householdId = await getHouseholdId(req.user.userId);
        await client.query('BEGIN');

        const fridgeRes = await client.query(
            `INSERT INTO fridges (household_id, name, model_type, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING id, household_id, name, model_type, created_by, created_at, updated_at`,
            [householdId, name.trim(), model_type, req.user.userId]
        );
        const fridge = fridgeRes.rows[0];

        const createdSections = [];
        for (let index = 0; index < sectionsToCreate.length; index++) {
            const section = sectionsToCreate[index];
            const sectionRes = await client.query(
                `INSERT INTO storage_sections
                    (household_id, fridge_id, name, section_type, section_key, position, has_door_space)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, household_id, fridge_id, name, section_type, section_key, position, has_door_space`,
                [
                    householdId,
                    fridge.id,
                    section.name,
                    section.section_type,
                    section.section_key,
                    section.position ?? index,
                    section.has_door_space,
                ]
            );
            createdSections.push(sectionRes.rows[0]);
        }

        const pantrySection = await ensurePantrySection(client, householdId);
        const mapped_items_count = await mapExistingItems(client, householdId, fridge.id, createdSections, pantrySection);

        await client.query('COMMIT');
        return res.status(201).json({
            fridge: { ...fridge, sections: [...createdSections, pantrySection] },
            mapped_items_count,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') {
            return res.status(409).json({ error: { code: 'FRIDGE_ALREADY_EXISTS', message: 'This fridge setup conflicts with an existing one' } });
        }
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    } finally {
        client.release();
    }
});

router.patch('/:id', async (req, res) => {
    const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    try {
        const householdId = await getHouseholdId(req.user.userId);
        const updated = await pool.query(
            `UPDATE fridges
             SET name = $1, updated_at = now()
             WHERE id = $2 AND household_id = $3
             RETURNING id`,
            [parsed.data.name.trim(), req.params.id, householdId]
        );
        if (!updated.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fridge not found' } });
        const fridge = await fetchFridge(pool, householdId, req.params.id);
        return res.status(200).json({ fridge });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

module.exports = router;
