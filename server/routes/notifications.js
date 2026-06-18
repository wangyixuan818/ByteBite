const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const reqAuth = require('../middleware/auth');

const router = express.Router();
router.use(reqAuth);


// GET /notifications 
// list the current user's notifications, unread first
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, item_id, type, message, notification_date, read_at, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY (read_at IS NULL) DESC, created_at DESC`,
            [req.user.userId]
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});


// PATCH /notifications/:id 
// flip read state
const updateNotificationSchema = z.object({
    read: z.boolean(),
});

router.patch('/:id', async (req, res) => {
    const parsed = updateNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: {
            code: 'VALIDATION_ERROR',
            message: msg
        }});
    }

    const readAt = parsed.data.read ? new Date() : null;

    try {
        const result = await pool.query(
            `UPDATE notifications
             SET read_at = $1
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [readAt, req.params.id, req.user.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: {
                code: 'NOT_FOUND',
                message: 'Notification not found'
            }});
        }
        return res.status(200).json({ notification: result.rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    }
});

module.exports = router;