const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');
const { requireHouseholdId } = require('../helpers/household');

const router = express.Router();
router.use(reqAuth);

const householdSchema = z.object({
    name: z.string().min(1).max(80),
});

const joinSchema = z.object({
    code: z.string().min(6).max(20),
});

function householdCode() {
    return crypto.randomBytes(5).toString('hex').toUpperCase();
}

async function insertHousehold(client, name) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const result = await client.query(
                `INSERT INTO households (name, code)
                 VALUES ($1, $2)
                 RETURNING id, name, code, created_at`,
                [name.trim(), householdCode()]
            );
            return result.rows[0];
        } catch (err) {
            if (err.code !== '23505') throw err;
        }
    }
    throw new Error('Could not generate a unique household code');
}

async function fetchHousehold(householdId) {
    const result = await pool.query(
        `SELECT h.id, h.name, h.code, h.created_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', u.id,
                            'email', u.email,
                            'display_name', u.display_name,
                            'profile_picture_url', u.profile_picture_url
                        )
                        ORDER BY u.display_name
                    ) FILTER (WHERE u.id IS NOT NULL),
                    '[]'
                ) AS members
         FROM households h
         JOIN user_household uh ON uh.household_id = h.id
         JOIN users u ON u.id = uh.user_id
         WHERE h.id = $1
         GROUP BY h.id`,
        [householdId]
    );
    return result.rows[0];
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT h.id, h.name, h.code, h.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', u.id,
                                'email', u.email,
                                'display_name', u.display_name,
                                'profile_picture_url', u.profile_picture_url
                            )
                            ORDER BY u.display_name
                        ) FILTER (WHERE u.id IS NOT NULL),
                        '[]'
                    ) AS members
             FROM households h
             JOIN user_household mine ON mine.household_id = h.id AND mine.user_id = $1
             JOIN user_household uh ON uh.household_id = h.id
             JOIN users u ON u.id = uh.user_id
             GROUP BY h.id
             ORDER BY h.created_at ASC`,
            [req.user.userId]
        );
        return res.status(200).json({ households: result.rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.post('/', async (req, res) => {
    const parsed = householdSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const household = await insertHousehold(client, parsed.data.name);
        await client.query(
            `INSERT INTO user_household (user_id, household_id, role)
             VALUES ($1, $2, 'owner')`,
            [req.user.userId, household.id]
        );
        await client.query('COMMIT');
        return res.status(201).json({ household: await fetchHousehold(household.id) });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    } finally {
        client.release();
    }
});

router.post('/join', async (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    try {
        const household = await pool.query(
            `SELECT id FROM households WHERE code = $1`,
            [parsed.data.code.trim().toUpperCase()]
        );
        if (!household.rows[0]) {
            return res.status(404).json({ error: { code: 'INVALID_HOUSEHOLD_CODE', message: 'Household code not found' } });
        }

        await pool.query(
            `INSERT INTO user_household (user_id, household_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (user_id, household_id) DO NOTHING`,
            [req.user.userId, household.rows[0].id]
        );
        return res.status(200).json({ household: await fetchHousehold(household.rows[0].id) });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.get('/:id/members', async (req, res) => {
    try {
        const householdId = await requireHouseholdId(req, res, req.params.id);
        if (!householdId) return;
        const household = await fetchHousehold(householdId);
        return res.status(200).json({ members: household.members });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.patch('/:id', async (req, res) => {
    const parsed = householdSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: msg } });
    }

    try {
        const householdId = await requireHouseholdId(req, res, req.params.id);
        if (!householdId) return;
        await pool.query(
            `UPDATE households SET name = $1 WHERE id = $2`,
            [parsed.data.name.trim(), householdId]
        );
        return res.status(200).json({ household: await fetchHousehold(householdId) });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.post('/:id/regenerate-code', async (req, res) => {
    try {
        const householdId = await requireHouseholdId(req, res, req.params.id);
        if (!householdId) return;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await pool.query(
                    `UPDATE households SET code = $1 WHERE id = $2`,
                    [householdCode(), householdId]
                );
                return res.status(200).json({ household: await fetchHousehold(householdId) });
            } catch (err) {
                if (err.code !== '23505') throw err;
            }
        }
        throw new Error('Could not generate a unique household code');
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    }
});

router.delete('/:id/members/me', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const membership = await client.query(
            `SELECT 1 FROM user_household WHERE user_id = $1 AND household_id = $2`,
            [req.user.userId, req.params.id]
        );
        if (!membership.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: { code: 'HOUSEHOLD_FORBIDDEN', message: 'You are not a member of this household' } });
        }

        const count = await client.query(
            `SELECT COUNT(*)::int AS count FROM user_household WHERE household_id = $1`,
            [req.params.id]
        );
        if (count.rows[0].count <= 1) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: { code: 'LAST_HOUSEHOLD_MEMBER', message: 'The last household member cannot leave' } });
        }

        await client.query(
            `DELETE FROM user_household WHERE user_id = $1 AND household_id = $2`,
            [req.user.userId, req.params.id]
        );
        await client.query('COMMIT');
        return res.status(204).end();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
    } finally {
        client.release();
    }
});

module.exports = router;
