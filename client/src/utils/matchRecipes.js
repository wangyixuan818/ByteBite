const urgentStatuses = new Set(['expired', 'expiring_today', 'expiring_soon', 'expiring_this_week']);

// Codex minimal UI pass: implement the matching rule documented by the original recipe TODO.
export function matchRecipes(items = [], recipes = [], limit = 5, selectedItemId = null) {
    const candidateItems = selectedItemId ? items.filter(item => item.id === selectedItemId) : items.filter(item => urgentStatuses.has(item.expiry_status));
    const availableTypes = new Set(candidateItems.map(item => Number(item.food_type_id)).filter(Boolean));
    if (!availableTypes.size) return [];

    return recipes.map(recipe => {
        const required = (recipe.food_types_required || []).map(Number);
        const matched_food_type_count = required.filter(typeId => availableTypes.has(typeId)).length;
        return { ...recipe, matched_food_type_count };
    }).filter(recipe => recipe.matched_food_type_count > 0)
      .sort((a, b) => b.matched_food_type_count - a.matched_food_type_count)
      .slice(0, limit);
}
