import { useState } from 'react';

export default function RecipeMatchSummary({ recipe }) {
    const [open, setOpen] = useState(false);
    const matchedItems = recipe.matching_items ?? recipe.matched_items ?? [];

    if (!matchedItems.length) return null;

    return (
        <div className="recipe-match-summary">
            <button className="text-button" type="button" onClick={() => setOpen(current => !current)}>
                Uses {matchedItems.length} inventory item{matchedItems.length === 1 ? '' : 's'}
            </button>

            {open && (
                <ul className="matched-item-list">
                    {matchedItems.map(item => (
                        <li key={item.id}>{item.name}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
