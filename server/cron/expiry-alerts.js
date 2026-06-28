// Scheduled job: marks active items whose expiry_date has passed as 'expired'
// Runs every day at 08:00 Singapore time

let cron = null;
try {
    cron = require('node-cron');
} catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    console.warn('[expiry-alerts] node-cron is unavailable; scheduled expiry jobs are disabled');
}
const pool = require('../db');

// The actual work, pulled out as a plain async function so it's directly testable
// (without having to wait for the cron schedule to fire)
async function markExpiredItems() {
    try {
        const result = await pool.query(
            `UPDATE items
             SET status = 'expired', updated_at = now()
             WHERE status = 'active'
               AND expiry_date IS NOT NULL
               AND expiry_date < CURRENT_DATE
             RETURNING id`
        );
        console.log(`[expiry-alerts] marked ${result.rowCount} item(s) as expired`);
        return result.rowCount;
    } catch (err) {
        console.error('[expiry-alerts] failed to mark expired items:', err);
        throw err;
    }
}

// Creates one notification per (user, item) for items expiring today through 3 days
// re-running on the same day inserts nothing cuz of unique constraint on user_id, item_id, type, notification_date
async function createExpiryNotifications() {
    try {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, item_id, type, message)
             SELECT
                 uh.user_id,
                 i.id,
                 CASE
                     WHEN i.expiry_date = CURRENT_DATE THEN 'expiring_today'
                     ELSE 'expiring_soon'
                 END,
                 CASE
                     WHEN i.expiry_date = CURRENT_DATE THEN i.name || ' expires today'
                     WHEN i.expiry_date = CURRENT_DATE + 1 THEN i.name || ' expires tomorrow'
                     ELSE i.name || ' expires in ' || (i.expiry_date - CURRENT_DATE) || ' days'
                 END
             FROM items i
             JOIN user_household uh ON uh.household_id = i.household_id
             WHERE i.status = 'active'
               AND i.expiry_date IS NOT NULL
               AND i.expiry_date >= CURRENT_DATE
               AND i.expiry_date <= CURRENT_DATE + 3
             ON CONFLICT (user_id, item_id, type, notification_date) DO NOTHING
             RETURNING id`
        );
        console.log(`[expiry-alerts] created ${result.rowCount} notification(s)`);
        return result.rowCount;
    } catch (err) {
        console.error('[expiry-alerts] failed to create notifications:', err);
        throw err;
    }
}

async function runExpiryAlertJobs() {
    await markExpiredItems();
    await createExpiryNotifications();
}

function getSingaporeHour(date = new Date()) {
    const hourPart = new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore',
        hour: 'numeric',
        hour12: false,
    }).formatToParts(date).find(part => part.type === 'hour');

    return Number(hourPart?.value);
}

function shouldRunStartupCatchup(date = new Date()) {
    return getSingaporeHour(date) >= 8;
}

// skip scheduling during tests so the job doesn't keep the event loop alive after tests finish
if (process.env.NODE_ENV !== 'test' && cron) {
    cron.schedule('0 8 * * *', runExpiryAlertJobs, { timezone: 'Asia/Singapore' });

    // If the server was not running at 08:00, node-cron cannot replay the missed run.
    // The notification insert is deduplicated per day, so this is safe across restarts.
    if (shouldRunStartupCatchup()) {
        runExpiryAlertJobs().catch(err => {
            console.error('[expiry-alerts] startup catch-up failed:', err);
        });
    }
}

module.exports = {
    markExpiredItems,
    createExpiryNotifications,
    runExpiryAlertJobs,
    getSingaporeHour,
    shouldRunStartupCatchup,
};
