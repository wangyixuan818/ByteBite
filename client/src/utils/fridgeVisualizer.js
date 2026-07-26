export const STORAGE_SECTIONS = [
    { id: 'fridge', label: 'Fridge main', storageValues: ['fridge'] },
    { id: 'fresh-zone', label: 'Fresh zone', storageValues: ['fresh zone'] },
    { id: 'fridge-door', label: 'Fridge door', storageValues: ['fridge door'] },
    { id: 'freezer', label: 'Freezer', storageValues: ['freezer'] },
    { id: 'pantry', label: 'Pantry', storageValues: ['pantry'] },
];

export const STORAGE_TYPE_OPTIONS = [
    { id: 'fridge', label: 'Fridge', temperature: '0-4 C', examples: 'Milk, leftovers, sauces' },
    { id: 'fresh_zone', label: 'Fresh zone', temperature: 'Around 0 C', examples: 'Meat, fish, leafy greens' },
    { id: 'freezer', label: 'Freezer', temperature: 'Below -18 C', examples: 'Frozen meals, dumplings, ice cream' },
];

export const FRIDGE_MODEL_SECTIONS = {
    two_layered: [
        { section_key: 'upper', name: 'Upper section', section_type: 'freezer', has_door_space: true },
        { section_key: 'lower', name: 'Lower section', section_type: 'fridge', has_door_space: true },
    ],
    three_layered: [
        { section_key: 'upper', name: 'Upper section', section_type: 'fridge', has_door_space: true },
        { section_key: 'middle', name: 'Middle section', section_type: 'fresh_zone', has_door_space: true },
        { section_key: 'lower', name: 'Lower section', section_type: 'freezer', has_door_space: true },
    ],
    mini: [
        { section_key: 'main', name: 'Main section', section_type: 'fridge', has_door_space: true },
    ],
    side_by_side: [
        { section_key: 'left', name: 'Left section', section_type: 'freezer', has_door_space: true },
        { section_key: 'right', name: 'Right section', section_type: 'fridge', has_door_space: true },
    ],
};

export const FRIDGE_VIEW_CONFIG = {
    'all-open': {
        scale: 1,
        x: '0%',
        y: '0%',
        inventoryLocation: null,
        label: 'Full inventory',
        imageLabel: 'Full open fridge and pantry',
    },
    'upper-door': {
        scale: 1.72,
        x: '13%',
        y: '10%',
        inventoryLocation: 'upper-door',
        sectionKey: 'upper',
        isDoor: true,
        label: 'Upper door',
        imageLabel: 'Upper fridge door',
        hotspot: { left: '16%', top: '13%', width: '17%', height: '24%', markerLeft: '46%', markerTop: '53%' },
    },
    'upper-fridge': {
        scale: 1.68,
        x: '-13%',
        y: '11%',
        inventoryLocation: 'upper-fridge',
        sectionKey: 'upper',
        isDoor: false,
        label: 'Upper section',
        imageLabel: 'Upper fridge section',
        hotspot: { left: '33%', top: '13%', width: '26%', height: '25%', markerLeft: '41%', markerTop: '52%' },
    },
    'lower-door': {
        scale: 1.55,
        x: '18%',
        y: '-16%',
        inventoryLocation: 'lower-door',
        sectionKey: 'lower',
        isDoor: true,
        label: 'Lower door',
        imageLabel: 'Lower fridge door',
        hotspot: { left: '16%', top: '43%', width: '19%', height: '36%', markerLeft: '34%', markerTop: '38%' },
    },
    'lower-fridge': {
        scale: 1.56,
        x: '-11%',
        y: '-15%',
        inventoryLocation: 'lower-fridge',
        sectionKey: 'lower',
        isDoor: false,
        label: 'Lower section',
        imageLabel: 'Lower fridge section',
        hotspot: { left: '34%', top: '44%', width: '25%', height: '35%', markerLeft: '37%', markerTop: '37%' },
    },
    pantry: {
        scale: 1.55,
        x: '-33%',
        y: '-6%',
        inventoryLocation: 'pantry',
        storage: 'pantry',
        label: 'Pantry',
        imageLabel: 'Pantry shelf',
        hotspot: { left: '61%', top: '33%', width: '17%', height: '46%', markerLeft: '47%', markerTop: '38%' },
    },
};

export const TWO_LAYERED_COMPARTMENT_VIEWS = ['upper-fridge', 'upper-door', 'lower-fridge', 'lower-door', 'pantry'];

export function getModelSections(modelId) {
    return FRIDGE_MODEL_SECTIONS[modelId] ?? FRIDGE_MODEL_SECTIONS.two_layered;
}

export function buildSectionDrafts(modelId) {
    return getModelSections(modelId).map(section => ({ ...section }));
}

export function getStorageTypeLabel(typeId) {
    return STORAGE_TYPE_OPTIONS.find(option => option.id === typeId)?.label || typeId;
}

export function getActiveFridge(fridges = [], selectedFridgeId = null) {
    return fridges.find(fridge => String(fridge.id) === String(selectedFridgeId)) ?? fridges[0] ?? null;
}

export function getCurrentFridgeItems(items = [], activeFridge = null) {
    if (!activeFridge) return [];
    return items.filter(item => !item.fridge_id || Number(item.fridge_id) === Number(activeFridge.id));
}

export function getVisibleInventoryItems({
    currentFridgeItems = [],
    activeInventoryView = null,
    activeSection = null,
    activeFridge = null,
    activeFridgeViewConfig = FRIDGE_VIEW_CONFIG['all-open'],
    focusedInventoryItemId = null,
} = {}) {
    if (activeInventoryView === 'item' && focusedInventoryItemId) {
        return currentFridgeItems.filter(item => item.id === focusedInventoryItemId);
    }

    if (activeFridgeViewConfig.inventoryLocation) {
        if (activeFridgeViewConfig.storage) {
            return currentFridgeItems.filter(item => item.storage === activeFridgeViewConfig.storage);
        }

        const focusedSection = activeFridge?.sections?.find(
            section => section.section_key === activeFridgeViewConfig.sectionKey
        );
        return currentFridgeItems.filter(item => {
            const itemSectionId = Number(item.storage_section_id);
            const focusedSectionId = Number(focusedSection?.id);
            if (focusedSectionId) {
                return itemSectionId === focusedSectionId && Boolean(item.is_in_door) === activeFridgeViewConfig.isDoor;
            }
            return Boolean(item.is_in_door) === activeFridgeViewConfig.isDoor;
        });
    }

    if (!activeInventoryView || activeInventoryView === 'all') return currentFridgeItems;
    return currentFridgeItems.filter(item => activeSection?.storageValues.includes(item.storage));
}
