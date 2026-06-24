import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRecipeList } from '../api/recipe';
import { getItemList } from '../api/item';
import RecipeList from '../components/RecipeList';
import { matchRecipes } from '../utils/matchRecipes';

// Codex minimal UI pass: connect recipes to expiring inventory and item-specific entry points.
export default function SuggestionPage() {
    const [searchParams] = useSearchParams();
    const [recipes, setRecipes] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const itemId = Number(searchParams.get('item'));

    useEffect(() => {
        Promise.all([getRecipeList(), getItemList()])
            .then(([recipeData, itemResponse]) => { setRecipes(recipeData); setItems(itemResponse.data); })
            .catch(() => setError('Failed to get recipes. The recipe API may not be available yet.'))
            .finally(() => setLoading(false));
    }, []);

    const selectedItem = items.find(item => item.id === itemId);
    const suggestions = useMemo(() => matchRecipes(items, recipes, 20, itemId || null), [items, recipes, itemId]);

    return (
        <main className="page-shell content-page">
            <nav className="topbar"><strong>ByteBite</strong><Link to="/dashboard">← Dashboard</Link></nav>
            <header><p className="eyebrow">Food usage suggestions</p><h1>{selectedItem ? `Use ${selectedItem.name}` : 'What to make next'}</h1><p>Recipes are matched using food types in your inventory, with soon-to-expire food ranked first.</p></header>
            {error && <p className="message error">{error}</p>}
            {loading ? <p className="panel empty-state">Loading recipes…</p> : <RecipeList recipeList={suggestions.length ? suggestions : recipes} />}
        </main>
    );
}
