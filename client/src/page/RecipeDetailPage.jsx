import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRecipe } from '../api/recipe';

export default function RecipeDetailPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recipe, setRecipe] = useState(null);
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
        <main className="page-shell content-page">
            <nav className="topbar"><strong>ByteBite</strong><Link to="/dashboard/recipes">← Suggestions</Link></nav>
            {loading && <p className="panel empty-state">Loading recipe...</p>}
            {error && <p className="message error">{error}</p>}
            {recipe && <article className="panel recipe-detail">
                <p className="eyebrow">{recipe.cuisine_type || 'Recipe'}</p>
                <h1>{recipe.name}</h1>
                <p>{[recipe.prep_time_minutes && `${recipe.prep_time_minutes} minutes`, recipe.difficulty_level, recipe.calories_kcal && `${recipe.calories_kcal} kcal`].filter(Boolean).join(' · ')}</p>
                <h2>Ingredients</h2>
                <p className="preserve-lines">{recipe.ingredients_text || 'Ingredients not provided.'}</p>
                <h2>Instructions</h2>
                <p className="preserve-lines">{recipe.instructions_text || 'Instructions not provided.'}</p>
            </article>}
        </main>
    );
}
