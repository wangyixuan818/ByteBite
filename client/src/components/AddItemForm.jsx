import { useEffect, useMemo, useState } from 'react';
import { addItem, createCategory, createFoodType, getBrands, getCategories, getFoodTypes, updateItem } from '../api/item';

const categoryIcons = import.meta.glob('../assets/bytebite-ui-v2/categories/*.png', { eager: true, import: 'default' });
const foodTypeIcons = import.meta.glob('../assets/bytebite-ui-v2/foodtypes/*.png', { eager: true, import: 'default' });

const blankDetails = {
    name: '',
    quantity: 1,
    unit: '',
    storage: '',
    expiryDate: '',
    // estimateExpiry: true,  
    saveFoodType: false,
};

const toDateInput = (value) => value ? String(value).split('T')[0] : '';
const slugify = (value) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const assetBySlug = (assetMap) => Object.fromEntries(
    Object.entries(assetMap).map(([path, src]) => [path.split('/').pop().replace('.png', ''), src])
);

const categoryIconBySlug = assetBySlug(categoryIcons);
const foodTypeIconBySlug = assetBySlug(foodTypeIcons);
const placeholderIcon = categoryIconBySlug['custom-placeholder'];

const getCategoryIcon = (name) => categoryIconBySlug[slugify(name)] ?? placeholderIcon;
const getFoodTypeIcon = (name) => foodTypeIconBySlug[slugify(name)] ?? placeholderIcon;

export const AddItemForm = ({ itemToEdit = null, onItemAdded, onItemUpdated }) => {
    const isEditing = Boolean(itemToEdit);
    const [step, setStep] = useState(isEditing ? 'details' : 'category');
    const [categories, setCategories] = useState([]);
    const [foodTypes, setFoodTypes] = useState([]);
    const [brandProducts, setBrandProducts] = useState([]);
    const [selectedBrandProductId, setSelectedBrandProductId] = useState('');
    const [brandName, setBrandName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedFoodType, setSelectedFoodType] = useState(null);
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [customFoodTypeName, setCustomFoodTypeName] = useState('');
    const [foodTypeIsCustom, setFoodTypeIsCustom] = useState(false);
    const [categoryIsCustom, setCategoryIsCustom] = useState(false);
    const [details, setDetails] = useState(() => itemToEdit ? {
        name: itemToEdit.name ?? '',
        quantity: itemToEdit.quantity ?? 1,
        unit: itemToEdit.unit ?? '',
        storage: itemToEdit.storage ?? '',
        expiryDate: toDateInput(itemToEdit.expiry_date),
        // estimateExpiry: false,
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
                    const existingBrand = brandRes.data.find(b => Number(b.id) === Number(itemToEdit.brand_product_id));
                    if (existingBrand) setBrandName(existingBrand.brand);
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

    const activeFoodIcon = selectedFoodType
        ? getFoodTypeIcon(selectedFoodType.name)
        : selectedCategory
            ? getCategoryIcon(selectedCategory.name)
            : placeholderIcon;

    const selectCategory = (category) => {
        setSelectedCategory(category);
        setCategoryIsCustom(false);
        setCustomFoodTypeName('');      
        setSelectedFoodType(null);
        setSelectedBrandProductId('');
        setStep('food-type');
        setError('');
    };

    const selectExistingFoodType = (type) => {
        setSelectedFoodType(type);
        setFoodTypeIsCustom(false);
        setDetails({ ...blankDetails, name: type.name });
        setSelectedBrandProductId('');
        setStep('details');
    };

    const continueCustomFoodType = (event) => {
        event.preventDefault();
        const trimmed = customFoodTypeName.trim();
        const clash = filteredTypes.some(t => normaliseName(t.name) === normaliseName(trimmed));
        if (clash) {
            setError('That food type already exists! Pick one from the list below.');
            return;
        }
        setSelectedFoodType(null);
        setFoodTypeIsCustom(true);
        setDetails({ ...blankDetails, name: trimmed });   // pre-fill the item Name with the food type
        setSelectedBrandProductId('');
        setStep('details');
        setError('');
    };

    const continueCustomCategory = (event) => {
        event.preventDefault();
        
        // defer the createCategory call to submit time, so we never create a category that the user abandons halfway through

        // make sure the custom category name doesn't clash with an existing one (case-insensitive)
        const trimmed = customCategoryName.trim();
        const clash = categories.some(c => normaliseName(c.name) === normaliseName(trimmed));
        if (clash) {
            setError('That category already exists! Pick one from the list below.');
            return;
        }

        setSelectedCategory(null);
        setCategoryIsCustom(true);
        setSelectedFoodType(null);
        setFoodTypeIsCustom(true);
        setDetails(blankDetails);
        setStep('details');
        setError('');
    };

    const updateDetail = (field, value) => setDetails(current => ({ ...current, [field]: value }));

    const buildPayload = async () => {
        let foodTypeId = selectedFoodType?.id ?? itemToEdit?.food_type_id;

        // Create the custom category now; buildPayload only runs when the item is actually saved
        let categoryId = selectedCategory?.id;
        if (!isEditing && categoryIsCustom) {
            const catResponse = await createCategory({ name: customCategoryName.trim() });
            categoryId = catResponse.data.category.id;
        }

        if (!isEditing && foodTypeIsCustom && details.saveFoodType) {
            const typeResponse = await createFoodType({
                name: details.name.trim(),
                category_id: categoryId,
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
            brand: brandName.trim() || undefined,
            brand_product_id: selectedBrandProductId ? Number(selectedBrandProductId) : undefined,
        };

        if (!isEditing && categoryId) payload.category_id = categoryId;
        if (details.expiryDate) payload.expiry_date = details.expiryDate;

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
            if (err.response?.status === 401) {
                setError('Please log in again before creating a category.');
            } else {
                setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
            } 
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
                            <span className="choice-icon-wrap" aria-hidden="true">
                                <img src={getCategoryIcon(category.name)} alt="" />
                            </span>
                            <span>{category.name}</span>
                        </button>
                    ))}
                </div>
                <div className="flow-divider"><span>or</span></div>
                <form className="form-stack" onSubmit={continueCustomCategory}>
                    <p className="field-title">Customize category</p>
                    <label>
                        Category name
                        <input value={customCategoryName} onChange={event => setCustomCategoryName(event.target.value)} placeholder="e.g. Fermented food" required />
                    </label>
                    <p className="helper-text">For now, custom categories use fridge as their default storage. We can make this editable later.</p>
                    <button className="button" disabled={submitting} type="submit">
                        {submitting ? 'Saving...' : 'Continue'}
                    </button>
                </form>
            </section>}

            {step === 'food-type' && <section>
                <button className="text-button align-left" type="button" onClick={() => setStep('category')}>← Categories</button>
                <p className="field-title">2. Choose a food type under {selectedCategory?.name}</p>
                <div className="choice-grid">
                    {filteredTypes.map(type => (
                        <button type="button" className="choice-button" key={type.id} onClick={() => selectExistingFoodType(type)}>
                            <span className="choice-icon-wrap" aria-hidden="true">
                                <img src={getFoodTypeIcon(type.name)} alt="" />
                            </span>
                            <span>{type.name}</span>
                        </button>
                    ))}
                </div>
                {!filteredTypes.length && <p className="helper-text">No existing food types in this category.</p>}
                <div className="flow-divider"><span>or</span></div>
                <form className="form-stack" onSubmit={continueCustomFoodType}>
                    <p className="field-title">Customize food type</p>
                    <label>
                        Food type name
                        <input value={customFoodTypeName} onChange={event => setCustomFoodTypeName(event.target.value)} placeholder="e.g. Bak Kwa" required />
                    </label>
                    <button className="button" type="submit">Continue</button>
                </form>
            </section>}

            {step === 'details' && <form className="form-stack" onSubmit={handleSubmit}>
                {!isEditing && <button className="text-button align-left" type="button" onClick={() => setStep(foodTypeIsCustom ? 'category' : 'food-type')}>← Back</button>}
                <div className="selected-food-summary">
                    <span className="choice-icon-wrap" aria-hidden="true">
                        <img src={activeFoodIcon} alt="" />
                    </span>
                    <div>
                        <small>{selectedCategory?.name ?? 'Food item'}</small>
                        <strong>{selectedFoodType?.name ?? (foodTypeIsCustom ? 'Custom food type' : details.name || 'Item details')}</strong>
                    </div>
                </div>
                <p className="field-title">
                    {isEditing ? 'Update item details' : foodTypeIsCustom ? '3. Customize food type and item' : '3. Item details'}
                </p>

                <label>
                    Name
                    <input value={details.name} onChange={event => updateDetail('name', event.target.value)} disabled={!isEditing && !foodTypeIsCustom} required />
                </label>

                <label>
                    <span>Brand <small>(optional)</small></span>
                    <input
                        type="text"
                        value={brandName}
                        onChange={event => setBrandName(event.target.value)}
                        placeholder="e.g. Meiji, FairPrice, Marigold"
                        list="brand-options"
                        autoComplete="off"
                    />
                    <datalist id="brand-options">
                        {filteredBrands.map(brand => (
                            <option key={brand.id} value={brand.brand} />
                        ))}
                    </datalist>
                    <span className="helper-text">Type any brand. Picking a known brand can improve expiry estimation.</span>
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
                
                {!isEditing && (
                    <div className="estimate-expiry-card active" aria-live="polite">
                        <span className="estimate-expiry-illustration" aria-hidden="true">
                            <span className="estimate-spark">!</span>
                        </span>
                        <span className="estimate-expiry-copy">
                            <strong>Smart expiry available</strong>
                            <small>Leave the expiry field below blank and ByteBite will estimate a date from food type, storage, and brand shelf-life.</small>
                        </span>
                    </div>
                )}

                <label>
                    <span>Expiry date <small>(optional)</small></span>
                    <input type="date" value={details.expiryDate} onChange={event => updateDetail('expiryDate', event.target.value)} />
                    <span className="helper-text">Leave blank and ByteBite will estimate one for you.</span>
                </label>

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
