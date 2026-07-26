import { describe, test, expect } from 'vitest';
import { parseDate, parseCommand } from '../components/QuickAddAssistant';

describe('parseCommand', () => {
    test('parses an add command', () => {
        const r = parseCommand('add 12 eggs', []);
        expect(r.action).toBe('add');
        expect(r.quantity).toBe(12);
    });
    test('detects a consume verb', () => {
        expect(parseCommand('consume 2 milk', []).action).toBe('consume');
    });
    test('detects dispose synonyms', () => {
        expect(parseCommand('throw away bread', []).action).toBe('dispose');
    });
    test('corrects "to" to 2', () => {
        expect(parseCommand('consume to milk', []).quantity).toBe(2);
    });
    test('no quantity leaves it unspecified', () => {
        expect(parseCommand('consume milk', []).quantity).toBe(null);
    });
});

describe('parseDate', () => {
    test('ISO date', () => expect(parseDate('2026-06-17')).toBe('2026-06-17'));
    test('day and month', () => expect(parseDate('17 june')).toBe('2026-06-17'));
    test('handles ordinal suffix', () => expect(parseDate('17th june')).toBe('2026-06-17'));
    test('numeric d/m', () => expect(parseDate('17/6')).toBe('2026-06-17'));
    test('today', () => {
        const d = new Date();
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        expect(parseDate('today')).toBe(iso);
    });
    test('in 3 days', () => expect(parseDate('in 3 days')).toBeTruthy());
    test('gibberish returns null', () => expect(parseDate('banana')).toBeNull());
});