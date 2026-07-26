import { describe, test, expect } from 'vitest';
import { foldText, normaliseName, searchByName } from '../utils/text';

describe('foldText', () => {
    test('lowercases and trims', () => expect(foldText('  Milk ')).toBe('milk'));
    test('collapses inner whitespace', () => expect(foldText('orange   juice')).toBe('orange juice'));
    test('does not strip a trailing s (search must not lose it)', () => expect(foldText('eggs')).toBe('eggs'));
    test('handles empty input', () => expect(foldText('')).toBe(''));
});

describe('normaliseName', () => {
    test('strips a trailing s', () => expect(normaliseName('prawns')).toBe('prawn'));
    test('prawn and prawns collapse to the same key', () =>
        expect(normaliseName('Prawn')).toBe(normaliseName('prawns')));
});

describe('searchByName', () => {
    const list = [{ name: 'Eggs' }, { name: 'Bread' }, { name: 'Egg Tart' }];
    test('empty query returns the list unchanged', () => expect(searchByName(list, '')).toEqual(list));
    test('filters out non-matches', () =>
        expect(searchByName(list, 'bread').map(i => i.name)).toEqual(['Bread']));
    test('ranks earlier-in-name matches first', () =>
        expect(searchByName(list, 'e').map(i => i.name)).toEqual(['Eggs', 'Egg Tart', 'Bread']));
    test('is case-insensitive', () =>
        expect(searchByName(list, 'BREAD').map(i => i.name)).toEqual(['Bread']));
});