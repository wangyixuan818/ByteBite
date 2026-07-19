import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getRecipe } from '../api/recipe';
import BrandTitle from '../components/BrandTitle';
import RecipeDifficulty from '../components/RecipeDifficulty';

const recipeIcons = import.meta.glob('../assets/bytebite-ui-v2/recipes/*.png', { eager: true, import: 'default' });
const fallbackIcons = import.meta.glob('../assets/bytebite-ui-v2/categories/custom-placeholder.png', { eager: true, import: 'default' });

const slugify = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const recipeIconBySlug = Object.fromEntries(
    Object.entries(recipeIcons).map(([path, src]) => [path.split('/').pop().replace('.png', ''), src])
);
const fallbackIcon = Object.values(fallbackIcons)[0];

export default function RecipeDetailPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recipe, setRecipe] = useState(null);
    const location = useLocation();
    const backTo = location.state?.from || '/dashboard/recipes'
    const { id } = useParams();

    useEffect(() => {
        getRecipe(id)
            .then(data => setRecipe(data))
            .catch(err => {
                const status = err.response?.status;
                setError(status === 404 ? 'Recipe not found.' : 'Could not load this recipe.');
            })
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <main className="page-shell content-page recipe-page recipe-detail-page">
            <nav className="topbar">
                <BrandTitle />
                <Link className="illustrated-back-link" to={backTo}>
                    <span aria-hidden="true">←</span>
                    Suggestions
                </Link>
            </nav>
            {loading && <p className="panel empty-state">Loading recipe...</p>}
            {error && <p className="message error">{error}</p>}
            {recipe && <article className="panel recipe-detail">
                <div className="recipe-detail-heading">
                    <div>
                        <p className="eyebrow">{recipe.cuisine_type || 'Recipe'}</p>
                        <h1>{recipe.name}</h1>
                    </div>
                    <span className="recipe-detail-icon" aria-hidden="true">
                        <img src={recipeIconBySlug[slugify(recipe.name)] ?? fallbackIcon} alt="" />
                    </span>
                </div>
                <p>{[recipe.prep_time_minutes && `${recipe.prep_time_minutes} minutes`, recipe.calories_kcal && `${recipe.calories_kcal} kcal`].filter(Boolean).join(' / ')}</p>
                <RecipeDifficulty level={recipe.difficulty_level} />
                {recipe.nutrition && (
                    <>
                        <h2>Nutrition</h2>
                        <p className="preserve-lines nutrition-copy">{recipe.nutrition}</p>
                    </>
                )}
                <h2>Ingredients</h2>
                <p className="preserve-lines">{recipe.ingredients_text || 'Ingredients not provided.'}</p>
                <h2>Instructions</h2>
                <p className="preserve-lines">{recipe.instructions_text || 'Instructions not provided.'}</p>
            </article>}
        </main>
    );
}
