export default function RecipeMatchSummary({ recipe }) {
    // TODO: Show why this recipe was suggested, for example:
    // "Uses 2 ingredients that expire this week".
    // TODO: Optionally list the matched item names after matchRecipes returns them.
    // TODO: Add accessible empty/fallback text when match metadata is unavailable.
    if (!recipe?.matched_food_type_count) return null;

    return (
        <p>
            Uses {recipe.matched_food_type_count} expiring ingredient
            {recipe.matched_food_type_count === 1 ? "" : "s"}
        </p>
    );
}
