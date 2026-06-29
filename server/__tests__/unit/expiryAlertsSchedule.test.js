const { getSingaporeHour, shouldRunStartupCatchup } = require('../../cron/expiry-alerts');

describe('expiry alert startup catch-up timing', () => {
    test('reads the Singapore hour from a UTC date', () => {
        expect(getSingaporeHour(new Date('2026-06-28T00:00:00.000Z'))).toBe(8);
    });

    test('does not catch up before 8am Singapore time', () => {
        expect(shouldRunStartupCatchup(new Date('2026-06-27T23:59:00.000Z'))).toBe(false);
    });

    test('catches up from 8am Singapore time onward', () => {
        expect(shouldRunStartupCatchup(new Date('2026-06-28T00:00:00.000Z'))).toBe(true);
        expect(shouldRunStartupCatchup(new Date('2026-06-28T07:30:00.000Z'))).toBe(true);
    });
});
