import { useEffect, useMemo, useState } from 'react';
import { addItem, createCategory, createFoodType, getCategories, getFoodTypes } from '../api/item';

const initialDetails = { name: '', quantity: 1, unit: '', storage: '', expiryDate: '', estimateExpiry: true, saveFoodType: false };

// Codex corrected add-food flow: category -> existing/custom food type -> inventory item.
export const AddItemForm = ({ onItemAdded }) => {
    const [step, setStep] = useState('category');
    const [categories, setCategories] = useState([]);
    const [foodTypes, setFoodTypes] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedFoodType, setSelectedFoodType] = useState(null);
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [customCategoryThumbnail, setCustomCategoryThumbnail] = useState(null);
    const [foodTypeIsCustom, setFoodTypeIsCustom] = useState(false);
    const [details, setDetails] = useState(initialDetails);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([getCategories(), getFoodTypes()])
            .then(([categoryRes, foodTypeRes]) => {
                setCategories(categoryRes.data);
                setFoodTypes(foodTypeRes.data);
            })
            .catch(() => setError('Failed to load the food library. Check that the server is running.'));
    }, []);

    const filteredTypes = useMemo(
        () => foodTypes.filter(type => Number(type.category_id) === Number(selectedCategory?.id)),
        [foodTypes, selectedCategory]
    );

    const selectCategory = (category) => {
        setSelectedCategory(category);
        setSelectedFoodType(null);
        setStep('food-type');
        setError('');
    };

    const openCustomCategory = () => {
        setSelectedCategory(null);
        setCustomCategoryName('');
        setCustomCategoryThumbnail(null);
        setStep('custom-category');
        setError('');
    };

    const selectExistingFoodType = (type) => {
        setSelectedFoodType(type);
        setFoodTypeIsCustom(false);
        setDetails({ ...initialDetails, name: type.name });
        setStep('details');
    };

    const openCustomFoodType = () => {
        setSelectedFoodType(null);
        setFoodTypeIsCustom(true);
        setDetails(initialDetails);
        setStep('details');
    };

    const continueCustomCategory = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            // Correct flow requires the new category to be auto-saved before food-type entry.
            const response = await createCategory({ name: customCategoryName.trim(), thumbnail: customCategoryThumbnail });
            setSelectedCategory(response.data.category);
            openCustomFoodType();
        } catch (err) {
            setError(err.response?.status === 404 || err.response?.status === 405
                ? 'Category saving needs the new POST /categories backend endpoint.'
                : err.response?.data?.error?.message || 'Could not save this category.');
        } finally {
            setSubmitting(false);
        }
    };

    const updateDetail = (field, value) => setDetails(current => ({ ...current, [field]: value }));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            let foodTypeId = selectedFoodType?.id;
            if (foodTypeIsCustom && details.saveFoodType) {
                const typeResponse = await createFoodType({
                    name: details.name.trim(),
                    category_id: selectedCategory.id,
                    default_storage: details.storage || undefined,
                });
                foodTypeId = typeResponse.data.food_type.id;
            }

            await addItem({
                name: details.name.trim(),
                quantity: Number(details.quantity),
                unit: details.unit.trim() || undefined,
                storage: details.storage || undefined,
                expiry_date: details.estimateExpiry ? undefined : details.expiryDate || undefined,
                category_id: selectedCategory?.id,
                food_type_id: foodTypeId,
            });
            onItemAdded();
        } catch (err) {
            const missingCatalogEndpoint = foodTypeIsCustom && details.saveFoodType && [404, 405].includes(err.response?.status);
            setError(missingCatalogEndpoint
                ? 'Saving a food type needs the new POST /food-types backend endpoint.'
                : err.response?.data?.error?.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-stack add-food-flow">
            {error && <p className="message error" role="alert">{error}</p>}

            {step === 'category' && <section>
                <p className="field-title">1. Choose an existing category</p>
                <div className="choice-grid">{categories.map(category => <button type="button" className="choice-button" key={category.id} onClick={() => selectCategory(category)}>{category.name}</button>)}</div>
                <div className="flow-divider"><span>or</span></div>
                <button type="button" className="button secondary" onClick={openCustomCategory}>+ Customize category</button>
            </section>}

            {step === 'custom-category' && <form className="form-stack" onSubmit={continueCustomCategory}>
                <button className="text-button align-left" type="button" onClick={() => setStep('category')}>← Categories</button>
                <p className="field-title">1. Customize category</p>
                <label>Category name<input value={customCategoryName} onChange={event => setCustomCategoryName(event.target.value)} placeholder="e.g. Fermented food" required /></label>
                <label>Thumbnail <small>(optional)</small><input type="file" accept="image/*" onChange={event => setCustomCategoryThumbnail(event.target.files?.[0] || null)} /></label>
                <p className="helper-text">This step follows the flow by saving the category before continuing. It will work once the catalog-create endpoint is added.</p>
                <button className="button" disabled={submitting} type="submit">{submitting ? 'Saving…' : 'Save category and continue'}</button>
            </form>}

            {step === 'food-type' && <section>
                <button className="text-button align-left" type="button" onClick={() => setStep('category')}>← Categories</button>
                <p className="field-title">2. Choose a food type under {selectedCategory?.name}</p>
                <div className="choice-grid">{filteredTypes.map(type => <button type="button" className="choice-button" key={type.id} onClick={() => selectExistingFoodType(type)}>{type.name}</button>)}</div>
                {!filteredTypes.length && <p className="helper-text">No existing food types in this category.</p>}
                <div className="flow-divider"><span>or</span></div>
                <button type="button" className="button secondary" onClick={openCustomFoodType}>+ Customize food type</button>
            </section>}

            {step === 'details' && <form className="form-stack" onSubmit={handleSubmit}>
                <button className="text-button align-left" type="button" onClick={() => setStep('food-type')}>← Food types</button>
                <p className="field-title">{foodTypeIsCustom ? '3. Customize food type and item' : '3. Item details'}</p>
                <label>Name<input value={details.name} onChange={event => updateDetail('name', event.target.value)} disabled={!foodTypeIsCustom} required /></label>
                <div className="form-row">
                    <label>Quantity<input type="number" min="1" step="1" value={details.quantity} onChange={event => updateDetail('quantity', event.target.value)} required /></label>
                    <label>Unit<input value={details.unit} onChange={event => updateDetail('unit', event.target.value)} placeholder="bag, bottle…" /></label>
                </div>
                <label>Storage<select value={details.storage} onChange={event => updateDetail('storage', event.target.value)}><option value="">Use catalog default</option><option value="fridge">Fridge</option><option value="fresh zone">Fresh zone</option><option value="freezer">Freezer</option><option value="fridge door">Fridge door</option><option value="pantry">Pantry</option></select></label>
                <label className="inline-choice"><input type="checkbox" checked={details.estimateExpiry} onChange={event => updateDetail('estimateExpiry', event.target.checked)} /> Estimate expiry automatically</label>
                {!details.estimateExpiry && <label>Expiry date<input type="date" value={details.expiryDate} onChange={event => updateDetail('expiryDate', event.target.value)} required /></label>}
                {foodTypeIsCustom && <label className="inline-choice"><input type="checkbox" checked={details.saveFoodType} onChange={event => updateDetail('saveFoodType', event.target.checked)} /> Save this custom food type into the food library</label>}
                {foodTypeIsCustom && details.saveFoodType && <p className="helper-text">Requires POST /food-types. Until that backend route exists, leave this unchecked to add only the inventory item.</p>}
                <button className="button" disabled={submitting} type="submit">{submitting ? 'Adding…' : 'Add item to inventory'}</button>
            </form>}
        </div>
    );
};
