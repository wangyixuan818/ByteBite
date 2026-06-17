// picking the right storage days
function pickDays(row, storage) {
    if (!row) return null;
    if (storage === 'freezer') return row.freezer_days ?? null;
    if (storage === 'pantry') return row.pantry_days ?? null;
    return row.fridge_days ?? null;  // fridge is default cuz we are FRIDGE tracker after all
}


module.exports = { pickDays };