import { describe, test, expect } from 'vitest';
import { matchRecipes } from '../utils/matchRecipes';

// small builders so each test seeds only what it needs
const item = (id, food_type_id, expiry_status) => ({ id, food_type_id, expiry_status });
const recipe = (id, name, food_types_required) => ({ id, name, food_types_required });

describe('matchRecipes', () => {
    test('returns empty when no items are urgent', () => {
        const items = [item(1, 10, 'ok'), item(2, 11, 'no_date')];
        const recipes = [recipe(100, 'Omelette', [10, 11])];
        expect(matchRecipes(items, recipes)).toEqual([]);
    });

    test('matches a recipe to an urgent item by food type', () => {
        const items = [item(1, 10, 'expiring_soon')];
        const recipes = [recipe(100, 'Omelette', [10])];
        const out = matchRecipes(items, recipes);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe(100);
        expect(out[0].matching_items).toHaveLength(1);
    });

    test('drops recipes with no matching urgent item', () => {
        const items = [item(1, 10, 'expiring_soon')];
        const recipes = [recipe(100, 'Uses eggs', [10]), recipe(101, 'Uses milk', [99])];
        const out = matchRecipes(items, recipes);
        expect(out.map(r => r.id)).toEqual([100]);   // 101 filtered out
    });

    test('ranks by urgency weight (today > soon > this_week)', () => {
        const items = [
            item(1, 10, 'expiring_this_week'),   // weight 1
            item(2, 11, 'expiring_today'),       // weight 3
        ];
        const recipes = [
            recipe(100, 'Low urgency', [10]),    // score 1
            recipe(101, 'High urgency', [11]),   // score 3
        ];
        const out = matchRecipes(items, recipes);
        expect(out.map(r => r.id)).toEqual([101, 100]);   // higher score first
    });

    test('sums urgency across multiple matching items', () => {
        const items = [
            item(1, 10, 'expiring_soon'),   // 2
            item(2, 10, 'expiring_today'),  // 3
        ];
        const recipes = [recipe(100, 'Eggs dish', [10])];
        const out = matchRecipes(items, recipes);
        expect(out[0].matching_score).toBe(5);          // 2 + 3
        expect(out[0].matching_items).toHaveLength(2);
    });

    test('selectedItemId restricts candidates to that one item', () => {
        const items = [
            item(1, 10, 'ok'),              // not urgent, but selected explicitly
            item(2, 11, 'expiring_today'),  // urgent, but not selected
        ];
        const recipes = [recipe(100, 'Uses type 10', [10]), recipe(101, 'Uses type 11', [11])];
        const out = matchRecipes(items, recipes, 1);    // select item 1
        expect(out.map(r => r.id)).toEqual([100]);      // only the selected item's recipe
    });

    test('handles string vs number ids (Number coercion)', () => {
        const items = [{ id: '1', food_type_id: '10', expiry_status: 'expiring_soon' }];
        const recipes = [recipe(100, 'Omelette', ['10'])];   // food_types_required as strings
        expect(matchRecipes(items, recipes)).toHaveLength(1);
    });

    test('defaults do not throw on empty input', () => {
        expect(matchRecipes()).toEqual([]);
        expect(matchRecipes([], [])).toEqual([]);
    });
});