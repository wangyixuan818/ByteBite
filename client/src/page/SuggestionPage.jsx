import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRecipeList } from '../api/recipe';
import { getItemList } from '../api/item';
import RecipeList from '../components/RecipeList';
import { matchRecipes } from '../utils/matchRecipes';
import BrandTitle from '../components/BrandTitle';

export default function SuggestionPage() {
    const [searchParams] = useSearchParams();
    const [recipes, setRecipes] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const itemId = Number(searchParams.get('item'));
    const mode = searchParams.get('mode') || 'library';  

    useEffect(() => {
        Promise.all([getRecipeList(), getItemList()])
            .then(([recipeData, itemResponse]) => {
                setRecipes(recipeData);
                setItems(itemResponse.data);
            })
            .catch(() => setError('Failed to get recipes. The recipe API may not be available yet.'))
            .finally(() => setLoading(false));
    }, []);

    const selectedItem = items.find(item => Number(item.id) === itemId);
    //const suggestion = useMemo(() => matchRecipes(items, recipes, itemId || null), [items, recipes, itemId]);
    const displayRecipes = useMemo(() => {
        if (mode === 'library') {
            return recipes;
        } 
        if (mode === 'use-item') {
            return matchRecipes(items, recipes, itemId);
        }
        if (mode === 'expiry-suggestion') {
            return matchRecipes(items, recipes, null);
        }
        
        return recipes;
    })

    return (
        <main className="page-shell content-page recipe-page">
            <nav className="topbar">
                <BrandTitle />
                <Link className="illustrated-back-link" to="/dashboard">
                    <span aria-hidden="true">←</span>
                    Dashboard
                </Link>
            </nav>
            <header>
                <p className="eyebrow">Food usage suggestions</p>
                <h1>{selectedItem ? `Use ${selectedItem.name}` : 'What to make next'}</h1>
                <p>Recipes are matched using food types in your inventory, with soon-to-expire food ranked first.</p>
            </header>
            {error && <p className="message error">{error}</p>}
            {loading ? <p className="panel empty-state">Loading recipes...</p> : <RecipeList recipeList={displayRecipes} />}
        </main>
    );
}
