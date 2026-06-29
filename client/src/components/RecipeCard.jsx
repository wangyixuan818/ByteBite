import { useNavigate } from 'react-router-dom';
import RecipeMatchSummary from './RecipeMatchSummary';
import RecipeDifficulty from './RecipeDifficulty';

const recipeIcons = import.meta.glob('../assets/bytebite-ui-v2/recipes/*.png', { eager: true, import: 'default' });
const categoryIcons = import.meta.glob('../assets/bytebite-ui-v2/categories/*.png', { eager: true, import: 'default' });

const slugify = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const assetBySlug = (assetMap) => Object.fromEntries(
    Object.entries(assetMap).map(([path, src]) => [path.split('/').pop().replace('.png', ''), src])
);

const recipeIconBySlug = assetBySlug(recipeIcons);
const categoryIconBySlug = assetBySlug(categoryIcons);
const fallbackIcon = categoryIconBySlug['custom-placeholder'];

const getRecipeIcon = (name) => recipeIconBySlug[slugify(name)] ?? fallbackIcon;

export default function RecipeCard({ recipe }) {
    const navigate = useNavigate();
    const meta = [
        recipe.cuisine_type,
        recipe.prep_time_minutes && `${recipe.prep_time_minutes} min`,
    ].filter(Boolean).join(' / ') || 'Recipe';

    return (
        <article className="panel recipe-card">
            <div className="recipe-card-art" aria-hidden="true">
                <span className="recipe-card-icon">
                    <img src={getRecipeIcon(recipe.name)} alt="" />
                </span>
            </div>
            <div className="recipe-card-copy">
                <h3>{recipe.name}</h3>
                <p>{meta}</p>
            </div>
            <RecipeDifficulty level={recipe.difficulty_level} />
            <RecipeMatchSummary recipe={recipe} />
            {recipe.calories_kcal && <p className="recipe-calories">{recipe.calories_kcal} kcal</p>}
            {recipe.nutrition && <p className="recipe-nutrition">{recipe.nutrition}</p>}
            <button className="button secondary" onClick={() => navigate(`/dashboard/recipes/${recipe.id}`)}>View recipe</button>
        </article>
    );
}
