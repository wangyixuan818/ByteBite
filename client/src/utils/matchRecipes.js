const URGENT_EXPIRY_STATUSES = new Set([
    'expiring_today',
    'expiring_soon',
    'expiring_this_week',
]);

const EXPIRY_URGENCY = {
    expiring_today: 3,
    expiring_soon: 2,
    expiring_this_week: 1,
};

export function matchRecipes(items = [], recipes = [], limit = 5, selectedItemId = null) {
    const candidateItems = selectedItemId
        ? items.filter(item => Number(item.id) === Number(selectedItemId))
        : items.filter(item => URGENT_EXPIRY_STATUSES.has(item.expiry_status));

    return recipes.map(recipe => {
        const requiredTypes = recipe.food_types_required ?? [];
        const matchingItems = candidateItems.filter(item => requiredTypes.includes(item.food_type_id));

        return {
            ...recipe,
            matching_score: matchingItems.reduce((sum, item) => sum + (EXPIRY_URGENCY[item.expiry_status] ?? 1), 0),
            matching_items: matchingItems,
        };
    })
        .filter(recipe => recipe.matching_score > 0)
        .sort((a, b) => b.matching_score - a.matching_score)
        .slice(0, limit);
}
