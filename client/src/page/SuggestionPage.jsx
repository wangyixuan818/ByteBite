import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRecipeList } from '../api/recipe';
import { getItemList, getFoodTypes } from '../api/item';
import RecipeList from '../components/RecipeList';
import BrandTitle from '../components/BrandTitle';
import { searchByName } from '../utils/text';

export default function SuggestionPage() {
    const [searchParams] = useSearchParams();
    const [recipes, setRecipes] = useState([]);
    const [items, setItems] = useState([]);
    const [foodTypes, setFoodTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchText, setSearchText] = useState('');              // searches recipe names
    const [ingredientSearch, setIngredientSearch] = useState('');  // searches the ingredient picker
    const [selectedIngredients, setSelectedIngredients] = useState(() => {
        const raw = searchParams.get('ingredients');
        return new Set(raw ? raw.split(',').map(Number).filter(n => n) : []);
    });

    useEffect(() => {
        Promise.all([getRecipeList(), getItemList(), getFoodTypes()])
            .then(([recipeData, itemResponse, foodTypeResponse]) => {
                setRecipes(recipeData);
                setItems(itemResponse.data);
                setFoodTypes(foodTypeResponse.data);
            })
            .catch(() => setError('Failed to get recipes. The recipe API may not be available yet.'))
            .finally(() => setLoading(false));
    }, []);

    // food_type_id -> name, for labelling ingredients and bubbles
    const nameById = useMemo(
        () => new Map(foodTypes.map(ft => [Number(ft.id), ft.name])),
        [foodTypes]
    );

    // distinct food types actually present in the fridge
    const fridgeIngredients = useMemo(() => {
        const seen = new Map();
        for (const item of items) {
            const id = Number(item.food_type_id);
            if (!id || seen.has(id)) continue;
            seen.set(id, { id, name: nameById.get(id) ?? item.name });
        }
        return [...seen.values()];
    }, [items, nameById]);

    // typeahead: fridge ingredients matching the search, excluding ones already added
    const suggestions = useMemo(() => {
        if (!ingredientSearch.trim()) return [];
        return searchByName(fridgeIngredients, ingredientSearch)
            .filter(ing => !selectedIngredients.has(ing.id))
            .slice(0, 6);
    }, [fridgeIngredients, ingredientSearch, selectedIngredients]);

    // selected ids resolved to names, for the bubbles
    const selectedList = useMemo(
        () => [...selectedIngredients].map(id => ({ id, name: nameById.get(id) ?? `#${id}` })),
        [selectedIngredients, nameById]
    );

    const addIngredient = (id) => {
        setSelectedIngredients(current => new Set(current).add(id));
        setIngredientSearch('');
    };

    const removeIngredient = (id) => {
        setSelectedIngredients(current => {
            const next = new Set(current);
            next.delete(id);
            return next;
        });
    };

    // recipes filtered by the name search box
    const searchedRecipes = useMemo(
        () => searchByName(recipes, searchText),
        [recipes, searchText]
    );

    // split into two sections by how many selected ingredients each recipe uses
    const { allMatches, someMatches } = useMemo(() => {
        if (selectedIngredients.size === 0) return { allMatches: [], someMatches: [] };
        const scored = searchedRecipes.map(recipe => {
            const required = new Set((recipe.food_types_required ?? []).map(Number));
            let overlap = 0;
            for (const id of selectedIngredients) if (required.has(id)) overlap += 1;
            return { recipe, overlap };
        });
        return {
            allMatches: scored.filter(r => r.overlap === selectedIngredients.size)
                              .sort((a, b) => b.overlap - a.overlap).map(r => r.recipe),
            someMatches: scored.filter(r => r.overlap >= 1 && r.overlap < selectedIngredients.size)
                               .sort((a, b) => b.overlap - a.overlap).map(r => r.recipe),
        };
    }, [searchedRecipes, selectedIngredients]);

    const filtering = selectedIngredients.size > 0;

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
                <h1>What to make next</h1>
                <div className="recipe-header-row">
                    <p>Pick ingredients from your fridge to find recipes, or search recipes by name.</p>
                    <div className="inventory-search-pill recipe-search-pill">
                        <input
                            type="text"
                            className="inventory-search-input"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
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

            <section className="ingredient-picker">
                <div className="ingredient-picker-head">
                    <span className="filter-group-label">Your fridge</span>
                    <div className="ingredient-search-wrap">
                        <input
                            type="text"
                            className="ingredient-search-input"
                            value={ingredientSearch}
                            onChange={e => setIngredientSearch(e.target.value)}
                            placeholder="Search ingredients to add..."
                        />
                        {suggestions.length > 0 && (
                            <ul className="ingredient-suggestions">
                                {suggestions.map(ing => (
                                    <li key={ing.id}>
                                        <button type="button" onClick={() => addIngredient(ing.id)}>{ing.name}</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {selectedList.length > 0 ? (
                    <div className="selected-ingredients">
                        {selectedList.map(ing => (
                            <span key={ing.id} className="ingredient-bubble">
                                {ing.name}
                                <button type="button" aria-label={`Remove ${ing.name}`} onClick={() => removeIngredient(ing.id)}>×</button>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="helper-text">Search and add ingredients you have to find matching recipes.</p>
                )}
            </section>

            {error && <p className="message error">{error}</p>}

            {loading ? (
                <p className="panel empty-state">Loading recipes...</p>
            ) : filtering ? (
                <>
                    <section className="recipe-section">
                        <h2>Uses all selected ingredients</h2>
                        {allMatches.length
                            ? <RecipeList recipeList={allMatches} />
                            : <p className="panel empty-state">No recipe uses all of your selected ingredients.</p>}
                    </section>
                    <section className="recipe-section">
                        <h2>Uses some of them</h2>
                        {someMatches.length
                            ? <RecipeList recipeList={someMatches} />
                            : <p className="panel empty-state">No partial matches.</p>}
                    </section>
                </>
            ) : searchedRecipes.length === 0 ? (
                <p className="panel empty-state">No recipes match “{searchText}”.</p>
            ) : (
                <RecipeList recipeList={searchedRecipes} />
            )}
        </main>
    );
}