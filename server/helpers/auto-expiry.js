async function autoEstimateShelfLife(name, foodTypeId, storage, addedDate) {
    return resolvedExpiryDate;
}

// picking the right storage days
function pickShelfLife(row, storage) {
    if (!row) return null;
    if (storage === 'freezer') return row.freezer_days ?? null;
    if (storage === 'pantry') return row.pantry_days ?? null;
    return row.fridge_days ?? null;  // fridge is default cuz we are FRIDGE tracker after all
}

// mappping to storage location to database
// locations: 'fridge','pantry','freezer', 'fridge door', 'fresh zone'
const storageMapping = {
    'pantry': 'pantry_shelf_life_days',
    'fridge': 'fridge_shelf_life_days',
    'fridge door': 'fridge_shelf_life_days', 
    'fresh zone': 'fridge_shelf_life_days',  
    'freezer': 'freezer_shelf_life_days'
};

// choose to default to fridge shelf life if undefined storage location
const storagePlace = storageMapping[storage] || 'fridge_shelf_life_days';

module.exports = { autoEstimateShelfLife, pickShelfLife };