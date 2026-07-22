const SECTION_STORAGE_MAP = {
    fridge: 'fridge',
    freezer: 'freezer',
    fresh_zone: 'fresh zone',
    pantry: 'pantry',
};

function storageFromSection(sectionType, isInDoor = false) {
    if (sectionType === 'fridge' && isInDoor) return 'fridge door';
    return SECTION_STORAGE_MAP[sectionType] ?? null;
}

async function getStorageSection(pool, householdId, sectionId) {
    const result = await pool.query(
        `SELECT id, household_id, fridge_id, name, section_type, section_key, position, has_door_space
         FROM storage_sections
         WHERE id = $1 AND household_id = $2`,
        [sectionId, householdId]
    );
    return result.rows[0] ?? null;
}

module.exports = { storageFromSection, getStorageSection };
