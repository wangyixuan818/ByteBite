const { formatDate, todayDate, addDays } = require('../../helpers/date');

// date converter
describe('formatDate', () => {
    test('formats a date as YYYY-MM-DD', () => {
        const d = new Date(2026, 7, 18);              // aug 18, 2026 (month is 0-indexed)
        expect(formatDate(d)).toBe('2026-08-18');
    });

    test('pads single-digit months and days with zero', () => {
        const d = new Date(2026, 0, 1);              // jan 1, 2026
        expect(formatDate(d)).toBe('2026-01-01');
    });

    test('handles end year boundary', () => {
        const d = new Date(2026, 11, 31);            // dec 31, 2026
        expect(formatDate(d)).toBe('2026-12-31');
    });
});

// convert today date
describe('todayDate', () => {
    test('returns today in YYYY-MM-DD format', () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const expected = `${yyyy}-${mm}-${dd}`;
        expect(todayDate()).toBe(expected);
    });
});

// add Days
describe('addDays', () => {
    test('adds the right number of days', () => {
        expect(addDays('2026-06-09', 7)).toBe('2026-06-16');
    });
    test('handles month boundaries', () => {
        expect(addDays('2026-06-28', 5)).toBe('2026-07-03');
    });
    test('handles year boundaries', () => {
        expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    });
    test('handles leap years correctly', () => {
        expect(addDays('2024-02-27', 3)).toBe('2024-03-01');     // 2024 is a leap year
    });
});