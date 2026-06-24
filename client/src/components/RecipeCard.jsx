import { useNavigate } from 'react-router-dom';
import RecipeMatchSummary from './RecipeMatchSummary';

// Codex minimal UI pass: make existing recipe data visible and navigable.
export default function RecipeCard({ recipe }) {
    const navigate = useNavigate();
    return (
        <article className="panel recipe-card">
            <div><h3>{recipe.name}</h3><p>{[recipe.cuisine_type, recipe.prep_time_minutes && `${recipe.prep_time_minutes} min`, recipe.difficulty_level].filter(Boolean).join(' · ') || 'Recipe'}</p></div>
            <RecipeMatchSummary recipe={recipe} />
            {recipe.calories_kcal && <p>{recipe.calories_kcal} kcal</p>}
            <button className="button secondary" onClick={() => navigate(`/dashboard/recipes/${recipe.id}`)}>View recipe</button>
        </article>
    );
}
