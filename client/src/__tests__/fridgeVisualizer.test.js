import { describe, expect, test } from 'vitest';
import {
    FRIDGE_VIEW_CONFIG,
    STORAGE_SECTIONS,
    buildSectionDrafts,
    getActiveFridge,
    getCurrentFridgeItems,
    getFridgeHotspotConfigs,
    getFridgeViewConfig,
    getStorageTypeLabel,
    getVisibleInventoryItems,
} from '../utils/fridgeVisualizer';

const item = (id, fields = {}) => ({ id, name: `Item ${id}`, ...fields });

const twoLayerFridge = {
    id: 10,
    model_type: 'two_layered',
    sections: [
        { id: 101, section_key: 'upper', section_type: 'freezer' },
        { id: 102, section_key: 'lower', section_type: 'fridge' },
        { id: 103, section_key: 'pantry', section_type: 'pantry', fridge_id: null },
    ],
};

describe('buildSectionDrafts', () => {
    test('returns the default sections for a fridge model', () => {
        expect(buildSectionDrafts('side_by_side')).toEqual([
            { section_key: 'left', name: 'Left section', section_type: 'freezer', has_door_space: true },
            { section_key: 'right', name: 'Right section', section_type: 'fridge', has_door_space: true },
        ]);
    });

    test('returns fresh copies so callers can edit drafts safely', () => {
        const firstDraft = buildSectionDrafts('mini');
        firstDraft[0].name = 'Changed in UI';

        expect(buildSectionDrafts('mini')[0].name).toBe('Main section');
    });

    test('falls back to two-layer sections for an unknown model', () => {
        expect(buildSectionDrafts('unknown-model').map(section => section.section_key)).toEqual(['upper', 'lower']);
    });
});

describe('getStorageTypeLabel', () => {
    test('returns friendly labels for known storage types', () => {
        expect(getStorageTypeLabel('fresh_zone')).toBe('Fresh zone');
    });

    test('falls back to the raw value for unknown storage types', () => {
        expect(getStorageTypeLabel('cellar')).toBe('cellar');
    });
});

describe('fridge view model overrides', () => {
    test('returns model-specific hotspot coordinates for shared view ids', () => {
        expect(getFridgeViewConfig('two_layered', 'lower-fridge').hotspot.markerLeft).toBe('37%');
        expect(getFridgeViewConfig('three_layered', 'lower-fridge').hotspot.markerLeft).toBe('64%');
    });

    test('keeps zoom settings available in model-specific view configs', () => {
        expect(getFridgeViewConfig('mini', 'mini-pantry')).toMatchObject({
            scale: 1.25,
            x: '-34%',
            y: '-3%',
        });
    });

    test('builds hotspot configs from the active fridge model only', () => {
        expect(getFridgeHotspotConfigs('mini').map(config => config.id)).toEqual([
            'main-fridge',
            'main-door',
            'mini-pantry',
        ]);
    });
});

describe('current fridge selection', () => {
    test('uses the selected fridge when it exists', () => {
        const fridges = [{ id: 1, name: 'Kitchen' }, { id: 2, name: 'Garage' }];

        expect(getActiveFridge(fridges, '2').name).toBe('Garage');
    });

    test('falls back to the first fridge when the stored selection is stale', () => {
        const fridges = [{ id: 1, name: 'Kitchen' }, { id: 2, name: 'Garage' }];

        expect(getActiveFridge(fridges, '999').name).toBe('Kitchen');
    });

    test('filters items to the active fridge while keeping pantry items', () => {
        const items = [
            item(1, { fridge_id: 10 }),
            item(2, { fridge_id: 20 }),
            item(3, { fridge_id: null, storage: 'pantry' }),
            item(4, { storage: 'fridge' }),
            item(5, { fridge_id: null, storage_section_id: 103, storage: 'pantry' }),
        ];

        expect(getCurrentFridgeItems(items, twoLayerFridge).map(i => i.id)).toEqual([1, 3, 5]);
    });
});

describe('getVisibleInventoryItems', () => {
    const currentFridgeItems = [
        item(1, { storage_section_id: 101, storage: 'freezer', is_in_door: false }),
        item(2, { storage_section_id: 101, storage: 'freezer', is_in_door: true }),
        item(3, { storage_section_id: 102, storage: 'fridge', is_in_door: false }),
        item(4, { storage_section_id: 102, storage: 'fridge door', is_in_door: true }),
        item(5, { storage_section_id: 103, storage: 'pantry', is_in_door: false }),
        item(6, { storage: 'fresh zone', is_in_door: false }),
    ];

    test('returns all current fridge items for the full inventory view', () => {
        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeInventoryView: 'all',
        }).map(i => i.id)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('filters section-list mode by broad storage bucket', () => {
        const freshZoneSection = STORAGE_SECTIONS.find(section => section.id === 'fresh-zone');

        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeInventoryView: 'fresh-zone',
            activeSection: freshZoneSection,
        }).map(i => i.id)).toEqual([6]);
    });

    test('focuses one item when opened from an item card', () => {
        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeInventoryView: 'item',
            focusedInventoryItemId: 4,
        }).map(i => i.id)).toEqual([4]);
    });

    test('filters a visual fridge section by section id and door state', () => {
        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeFridge: twoLayerFridge,
            activeFridgeViewConfig: FRIDGE_VIEW_CONFIG['upper-fridge'],
        }).map(i => i.id)).toEqual([1]);

        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeFridge: twoLayerFridge,
            activeFridgeViewConfig: FRIDGE_VIEW_CONFIG['upper-door'],
        }).map(i => i.id)).toEqual([2]);
    });

    test('filters pantry visual focus by storage value', () => {
        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeFridge: twoLayerFridge,
            activeFridgeViewConfig: FRIDGE_VIEW_CONFIG.pantry,
        }).map(i => i.id)).toEqual([5]);
    });

    test('falls back to door state when a focused fridge section is missing', () => {
        expect(getVisibleInventoryItems({
            currentFridgeItems,
            activeFridge: { id: 10, sections: [] },
            activeFridgeViewConfig: FRIDGE_VIEW_CONFIG['lower-door'],
        }).map(i => i.id)).toEqual([2, 4]);
    });
});
