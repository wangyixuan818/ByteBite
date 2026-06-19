import { getRecipe, getRecipeList } from "../api/recipe";
import { useEffect, useState } from "react";
import RecipeCard from "../components/RecipeCard";
import RecipeList from "../components/RecipeList";

export default function SuggestionPage() {
    const [recipeList, setRecipeList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchRecipes = async () => {
        try {
            const res = await getRecipeList();
            setRecipeList(res);
        } catch (err) {
            setError("Failed to get recipes. Please try again.")
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchRecipes();
    }, []);


    return (
        <div>
            <h1>Food Consumption Suggestion</h1>
            {loading? <p>Loading...</p>: <RecipeList recipeList={recipeList} />}
            {error && <p>{error}</p>}
        </div>
    );
}