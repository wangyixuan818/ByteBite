import { useEffect, useMemo, useState } from 'react';
import { addItem, createCategory, createFoodType, getBrands, getCategories, getFoodTypes, updateItem } from '../api/item';

const blankDetails = {
    name: '',
    quantity: 1,
    unit: '',
    storage: '',
    expiryDate: '',
    estimateExpiry: true,
    saveFoodType: false,
};

const toDateInput = (value) => value ? String(value).split('T')[0] : '';

export const AddItemForm = ({ itemToEdit = null, onItemAdded, onItemUpdated }) => {
    const isEditing = Boolean(itemToEdit);
    const [step, setStep] = useState(isEditing ? 'details' : 'category');
    const [categories, setCategories] = useState([]);
    const [foodTypes, setFoodTypes] = useState([]);
    const [brandProducts, setBrandProducts] = useState([]);
    const [selectedBrandProductId, setSelectedBrandProductId] = useState('');
    // MS3 revisit: free-typed brand input is paused because brand-specific expiry needs curated shelf-life data.
    // const [brandName, setBrandName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedFoodType, setSelectedFoodType] = useState(null);
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [foodTypeIsCustom, setFoodTypeIsCustom] = useState(false);
    const [details, setDetails] = useState(() => itemToEdit ? {
        name: itemToEdit.name ?? '',
        quantity: itemToEdit.quantity ?? 1,
        unit: itemToEdit.unit ?? '',
        storage: itemToEdit.storage ?? '',
        expiryDate: toDateInput(itemToEdit.expiry_date),
        estimateExpiry: false,
        saveFoodType: false,
    } : blankDetails);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadLibrary = async () => {
            try {
                const [categoryRes, foodTypeRes, brandRes] = await Promise.all([
                    getCategories(),
                    getFoodTypes(),
                    getBrands(),
                ]);

                setCategories(categoryRes.data);
                setFoodTypes(foodTypeRes.data);
                setBrandProducts(brandRes.data);

                if (itemToEdit?.food_type_id) {
                    const existingType = foodTypeRes.data.find(type => Number(type.id) === Number(itemToEdit.food_type_id));
                    setSelectedFoodType(existingType ?? null);
                    if (existingType) {
                        setSelectedCategory(categoryRes.data.find(category => Number(category.id) === Number(existingType.category_id)) ?? null);
                    }
                }

                if (itemToEdit?.brand_product_id) {
                    setSelectedBrandProductId(String(itemToEdit.brand_product_id));
                }
            } catch {
                setError('Failed to load the food library.');
            }
        };

        loadLibrary();
    }, [itemToEdit]);

    const filteredTypes = useMemo(
        () => foodTypes.filter(type => Number(type.category_id) === Number(selectedCategory?.id)),
        [foodTypes, selectedCategory]
    );

    const filteredBrands = useMemo(
        () => selectedFoodType
            ? brandProducts.filter(brand => Number(brand.food_type_id) === Number(selectedFoodType.id))
            : brandProducts,
        [brandProducts, selectedFoodType]
    );

    const selectCategory = (category) => {
        setSelectedCategory(category);
        setSelectedFoodType(null);
        setSelectedBrandProductId('');
        setStep('food-type');
        setError('');
    };

    const openCustomCategory = () => {
        setSelectedCategory(null);
        setCustomCategoryName('');
        setStep('custom-category');
        setError('');
    };

    const selectExistingFoodType = (type) => {
        setSelectedFoodType(type);
        setFoodTypeIsCustom(false);
        setDetails({ ...blankDetails, name: type.name });
        setSelectedBrandProductId('');
        setStep('details');
    };

    const openCustomFoodType = () => {
        setSelectedFoodType(null);
        setFoodTypeIsCustom(true);
        setDetails(blankDetails);
        setSelectedBrandProductId('');
        setStep('details');
    };

    const continueCustomCategory = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const response = await createCategory({ name: customCategoryName.trim() });
            setSelectedCategory(response.data.category);
            setSelectedFoodType(null);
            setFoodTypeIsCustom(true);
            setDetails(blankDetails);
            setStep('details');
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Please log in again before creating a category.');
            } else {
                setError(err.response?.data?.error?.message || 'Could not save this category.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const updateDetail = (field, value) => setDetails(current => ({ ...current, [field]: value }));

    const buildPayload = async () => {
        let foodTypeId = selectedFoodType?.id ?? itemToEdit?.food_type_id;

        if (!isEditing && foodTypeIsCustom && details.saveFoodType) {
            const typeResponse = await createFoodType({
                name: details.name.trim(),
                category_id: selectedCategory.id,
                default_storage: details.storage || undefined,
            });
            foodTypeId = typeResponse.data.food_type.id;
        }

        const payload = {
            name: details.name.trim(),
            quantity: Number(details.quantity),
            unit: details.unit.trim() || undefined,
            storage: details.storage || undefined,
            food_type_id: foodTypeId || undefined,
            brand_product_id: selectedBrandProductId ? Number(selectedBrandProductId) : undefined,
        };

        if (!isEditing && selectedCategory?.id) payload.category_id = selectedCategory.id;
        if (!details.estimateExpiry && details.expiryDate) payload.expiry_date = details.expiryDate;

        return payload;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = await buildPayload();
            if (isEditing) {
                await updateItem(itemToEdit.id, payload);
                onItemUpdated?.();
            } else {
                await addItem(payload);
                onItemAdded?.();
            }
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="form-stack add-food-flow">
            {error && <p className="message error" role="alert">{error}</p>}

            {step === 'category' && <section>
                <p className="field-title">1. Choose an existing category</p>
                <div className="choice-grid">
                    {categories.map(category => (
                        <button type="button" className="choice-button" key={category.id} onClick={() => selectCategory(category)}>
                            {category.name}
                        </button>
                    ))}
                </div>
                <div className="flow-divider"><span>or</span></div>
                <button type="button" className="button secondary" onClick={openCustomCategory}>+ Customize category</button>
            </section>}

            {step === 'custom-category' && <form className="form-stack" onSubmit={continueCustomCategory}>
                <button className="text-button align-left" type="button" onClick={() => setStep('category')}>← Categories</button>
                <p className="field-title">1. Customize category</p>
                <label>
                    Category name
                    <input value={customCategoryName} onChange={event => setCustomCategoryName(event.target.value)} placeholder="e.g. Fermented food" required />
                </label>
                <p className="helper-text">For now, custom categories use fridge as their default storage. We can make this editable later.</p>
                <button className="button" disabled={submitting} type="submit">
                    {submitting ? 'Saving...' : 'Save category and continue'}
                </button>
            </form>}

            {step === 'food-type' && <section>
                <button className="text-button align-left" type="button" onClick={() => setStep('category')}>← Categories</button>
                <p className="field-title">2. Choose a food type under {selectedCategory?.name}</p>
                <div className="choice-grid">
                    {filteredTypes.map(type => (
                        <button type="button" className="choice-button" key={type.id} onClick={() => selectExistingFoodType(type)}>
                            {type.name}
                        </button>
                    ))}
                </div>
                {!filteredTypes.length && <p className="helper-text">No existing food types in this category.</p>}
                <div className="flow-divider"><span>or</span></div>
                <button type="button" className="button secondary" onClick={openCustomFoodType}>+ Customize food type</button>
            </section>}

            {step === 'details' && <form className="form-stack" onSubmit={handleSubmit}>
                {!isEditing && <button className="text-button align-left" type="button" onClick={() => setStep(foodTypeIsCustom ? 'category' : 'food-type')}>← Back</button>}
                <p className="field-title">
                    {isEditing ? 'Update item details' : foodTypeIsCustom ? '3. Customize food type and item' : '3. Item details'}
                </p>

                <label>
                    Name
                    <input value={details.name} onChange={event => updateDetail('name', event.target.value)} disabled={!isEditing && !foodTypeIsCustom} required />
                </label>

                <label>
                    Brand <small>(optional)</small>
                    <select value={selectedBrandProductId}
                            onChange={event => setSelectedBrandProductId(event.target.value)}>
                        <option value="">No brand / not sure</option>
                        {filteredBrands.map(brand => (
                            <option key={brand.id}
                                    value={brand.id}>{brand.brand}
                            </option>
                        ))}
                    </select>
                    <span className="helper-text">Optional. Selecting an existing brand can improve expiry estimation when the brand has curated shelf-life data.</span>
                    {/* MS3 revisit: free-typed brand input is paused because unsaved brands do not have reliable expiry rules yet.
                    <input
                        value={brandName}
                        onChange={event => setBrandName(event.target.value)}
                        placeholder="e.g. Meiji, FairPrice, Marigold"
                        list="brand-options"
                    />
                    */}
                </label>

                <div className="form-row">
                    <label>
                        Quantity
                        <input type="number" min="1" step="1" value={details.quantity} onChange={event => updateDetail('quantity', event.target.value)} required />
                    </label>
                    <label>
                        Unit
                        <input value={details.unit} onChange={event => updateDetail('unit', event.target.value)} placeholder="bag, bottle..." />
                    </label>
                </div>

                <label>
                    Storage
                    <select value={details.storage} onChange={event => updateDetail('storage', event.target.value)}>
                        <option value="">Use catalog default</option>
                        <option value="fridge">Fridge</option>
                        <option value="fresh zone">Fresh zone</option>
                        <option value="freezer">Freezer</option>
                        <option value="fridge door">Fridge door</option>
                        <option value="pantry">Pantry</option>
                    </select>
                </label>

                {!isEditing && <label className="inline-choice">
                    <input type="checkbox" checked={details.estimateExpiry} onChange={event => updateDetail('estimateExpiry', event.target.checked)} />
                    Estimate expiry automatically
                </label>}

                {(isEditing || !details.estimateExpiry) && <label>
                    Expiry date
                    <input type="date" value={details.expiryDate} onChange={event => updateDetail('expiryDate', event.target.value)} />
                </label>}

                {!isEditing && foodTypeIsCustom && <label className="inline-choice">
                    <input type="checkbox" checked={details.saveFoodType} onChange={event => updateDetail('saveFoodType', event.target.checked)} />
                    Save this custom food type into the food library
                </label>}

                <button className="button" disabled={submitting} type="submit">
                    {submitting ? 'Saving...' : isEditing ? 'Update item' : 'Add item to inventory'}
                </button>
            </form>}
        </div>
    );
};
