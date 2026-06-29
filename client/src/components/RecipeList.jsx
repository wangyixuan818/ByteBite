import RecipeCard from "./RecipeCard";

export default function RecipeList({ recipeList }){
    if (!recipeList.length) return <p className="panel empty-state">No matching recipes are available yet.</p>;
    return <div className="recipe-list">{recipeList.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>;
}
