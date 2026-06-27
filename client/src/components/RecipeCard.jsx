import { useNavigate } from 'react-router-dom';
import RecipeMatchSummary from './RecipeMatchSummary';

const foodTypeIcons = import.meta.glob('../assets/bytebite-ui-v2/foodtypes/*.png', { eager: true, import: 'default' });
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

const foodTypeIconBySlug = assetBySlug(foodTypeIcons);
const categoryIconBySlug = assetBySlug(categoryIcons);
const fallbackIcon = categoryIconBySlug['custom-placeholder'];

const getRecipeIcon = (name) => foodTypeIconBySlug[slugify(name)] ?? fallbackIcon;

export default function RecipeCard({ recipe }) {
    const navigate = useNavigate();
    const matchedItems = recipe.matching_items ?? recipe.matched_items ?? [];
    const visibleIcons = matchedItems.length ? matchedItems.slice(0, 3) : [{ id: 'fallback', name: recipe.name }];
    const meta = [
        recipe.cuisine_type,
        recipe.prep_time_minutes && `${recipe.prep_time_minutes} min`,
        recipe.difficulty_level,
    ].filter(Boolean).join(' / ') || 'Recipe';

    return (
        <article className="panel recipe-card">
            <div className="recipe-card-art" aria-hidden="true">
                {visibleIcons.map((item, index) => (
                    <span className="recipe-card-icon" key={item.id ?? `${item.name}-${index}`} style={{ '--i': index }}>
                        <img src={getRecipeIcon(item.name)} alt="" />
                    </span>
                ))}
            </div>
            <div className="recipe-card-copy">
                <h3>{recipe.name}</h3>
                <p>{meta}</p>
            </div>
            <RecipeMatchSummary recipe={recipe} />
            {recipe.calories_kcal && <p className="recipe-calories">{recipe.calories_kcal} kcal</p>}
            <button className="button secondary" onClick={() => navigate(`/dashboard/recipes/${recipe.id}`)}>View recipe</button>
        </article>
    );
}
