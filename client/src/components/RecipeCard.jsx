import { useNavigate } from "react-router-dom";

export default function RecipeCard({ recipe }) {
    const navigate = useNavigate;
    const handleView = () => {
        navigate(`/recipes/${recipe.id}`);
    }
    return (
        <div>
            <p>{recipe.name}</p>
            <p>{`${cuisine_type} · ${prep_time_minutes} min · Dfficulty ${diffculty_level}`}</p>
            <p>{`${calories_kcal} kcal`}</p>
            <button onClick={handleView}>View recipe</button>
        </div>
    )
}