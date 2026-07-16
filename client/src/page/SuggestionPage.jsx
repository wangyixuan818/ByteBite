import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRecipeList } from '../api/recipe';
import { getItemList } from '../api/item';
import RecipeList from '../components/RecipeList';
import { matchRecipes } from '../utils/matchRecipes';
import BrandTitle from '../components/BrandTitle';
import { searchByName } from '../utils/text';

export default function SuggestionPage() {
    const [searchParams] = useSearchParams();
    const [recipes, setRecipes] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchText, setSearchText] = useState('');
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
    }, [mode, recipes, items, itemId]);

    const searchedRecipes = useMemo(
        () => searchByName(displayRecipes, searchText),
        [displayRecipes, searchText]
    );

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
                <div className="recipe-header-row">
                    <p>Recipes are matched using food types in your inventory, with soon-to-expire food ranked first.</p>
                    <div className="inventory-search-pill recipe-search-pill">
                        <input
                            type="text"
                            className="inventory-search-input"
                            value={searchText}
                            onChange={event => setSearchText(event.target.value)}
                            placeholder="Search recipes..."
                        />
                        <span className="inventory-search-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                    </div>
                </div>
            </header>
            {error && <p className="message error">{error}</p>}
            {loading ? (
                <p className="panel empty-state">Loading recipes...</p>
            ) : searchedRecipes.length === 0 ? (
                <p className="panel empty-state">No recipes match “{searchText}”.</p>
            ) : (
                <RecipeList recipeList={searchedRecipes} />
            )}
        </main>
    );
}
