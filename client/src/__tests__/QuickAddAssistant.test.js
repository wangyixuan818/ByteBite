import { describe, test, expect } from 'vitest';
import { parseDate, parseCommand, pickStoragePlacement } from '../components/QuickAddAssistant';

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
    test('keeps matched food type default storage', () => {
        const r = parseCommand('add milk', [{ id: 1, name: 'Milk', default_storage: 'fridge' }]);
        expect(r.defaultStorage).toBe('fridge');
    });
});

describe('pickStoragePlacement', () => {
    const fridge = {
        id: 10,
        sections: [
            { id: 101, fridge_id: 10, section_type: 'freezer', has_door_space: true },
            { id: 102, fridge_id: 10, section_type: 'fridge', has_door_space: true },
            { id: 103, fridge_id: null, section_type: 'pantry', has_door_space: false },
        ],
    };

    test('chooses a matching fridge section', () => {
        expect(pickStoragePlacement(fridge, 'fridge')).toEqual({
            storage_section_id: 102,
            is_in_door: false,
        });
    });

    test('chooses pantry when the matched item defaults there', () => {
        expect(pickStoragePlacement(fridge, 'pantry')).toEqual({
            storage_section_id: 103,
            is_in_door: false,
        });
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
