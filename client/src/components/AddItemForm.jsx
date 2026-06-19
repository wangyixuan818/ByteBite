    import { addItem, getCategories, getFoodTypes } from '../api/item';
    import { useEffect, useState } from "react";

    export const AddItemForm = ({ onItemAdded }) => {
        const [isCustom, setIsCustom] = useState(false);
        const [name, setName] = useState("");
        const [quantity, setQuantity] = useState(1);
        const [unit, setUnit] = useState("");
        const [storage, setStorage] = useState(""); // API contract change: omit storage so the server can use catalog default_storage.
        const [expiryDate, setExpiryDate] = useState(""); // API contract change: blank expiry lets the server calculate auto-expiry.
        const [categoryList, setCategoryList] = useState([]);
        const [foodTypeList, setFoodTypeList] = useState([]);
        useEffect(() => {
            Promise.all([getCategories(), getFoodTypes()]) // API contract change: categories are no longer embedded on food types.
                .then(([categoryRes, foodTypeRes]) => {
                    setCategoryList(categoryRes.data);
                    setFoodTypeList(foodTypeRes.data);
                })
                .catch(() => setError("Failed to load food categories. Please try again."));
        }, [])
        const [selectedCategory, setSelectedCategory] = useState(null);
        const [selectedFoodType, setSelectedFoodType] = useState(null);
        const filteredFoodTypes = foodTypeList.filter(ft => ft.category_id === selectedCategory?.id); // API contract change: filter by category_id.
        const [error, setError] = useState("");
        const formState = {name, setName, quantity, setQuantity, unit, setUnit, 
            storage, setStorage, expiryDate, setExpiryDate, 
            foodTypeList, setFoodTypeList, categoryList, 
            selectedCategory, setSelectedCategory, selectedFoodType, setSelectedFoodType, filteredFoodTypes
        }


        const handleRequest = async (e) => {
            e.preventDefault();
            
            try {
                await addItem({
                    name,
                    quantity,
                    unit: unit || undefined, 
                    storage: storage || undefined, // API contract change: undefined allows backend default_storage fallback.
                    expiry_date: expiryDate || undefined, // API contract change: undefined triggers backend auto-expiry lookup.
                    category_id: selectedCategory?.id, // API contract change: category_id is part of the new catalog hierarchy.
                    food_type_id: isCustom ? undefined: Number(selectedFoodType?.id),
                });
                onItemAdded();
            } catch (err) {
                const code = err.response?.data?.error?.code;
                const message = err.response?.data?.error?.message;
                if (code === 'VALIDATION_ERROR') {
                    setError(message || "Please check you inputs");
                } else {
                    setError("Something went wrong. Please try again.")
                }
            } 
        }
            
        return (
            <div>
                {error ? <p>{error}</p>: null }
                <p>Select from follwoing items: </p>
                <input type="radio" 
                       name="itemMode" 
                       value="existing" 
                       checked={!isCustom} 
                       onChange={() => setIsCustom(false)}
                /> Use existing food types:
                {!isCustom && <ExistingItems formState={formState} handleRequest={handleRequest}/>}
                <input type="radio" 
                       name="itemMode" 
                       value="custom" 
                       checked={isCustom} 
                       onChange={() => setIsCustom(true)}
                /> Custom item:
                {isCustom && <FoodForm formState={formState} handleRequest={handleRequest}/>}
            </div>
        );
        
        
    }

    // the customization form no matter what adding item mode the user chooses
    function FoodForm({formState = {}, handleRequest}) {
        const {name, setName, quantity, setQuantity, unit, setUnit, 
            storage, setStorage, expiryDate, setExpiryDate, selectedFoodType
        } = formState;

        useEffect(() => {
            if (selectedFoodType) {
                setName(selectedFoodType.name);
                setExpiryDate(""); // API contract change: default_shelf_life_days was removed; backend now estimates expiry.
            }
        }, [selectedFoodType])

        return (
            <form onSubmit={handleRequest}>
                <input type="text" value={name} placeholder="Item name" onChange={e => setName(e.target.value)} required/>
                <br />
                <input type="number" value={quantity} placeholder="Quantity" onChange={e => setQuantity(Number(e.target.value))} />
                <br />
                <input type="text" value={unit} placeholder="Unit" onChange={e => setUnit(e.target.value)}/>
                <br />
                <select value={storage} onChange={e => setStorage(e.target.value)}>
                    <option value="">Use default storage</option>
                    <option value="fridge">Fridge</option>
                    <option value="fresh zone">Fresh Zone</option>
                    <option value="freezer">Freezer</option>
                    <option value="fridge door">Fridge Door</option>
                    <option value="pantry">Pantry</option>
                </select>
                <br />
                <input type="date" value={expiryDate} placeholder="Expiry date" onChange={e => setExpiryDate(e.target.value)} />
                <br />
                <button type="submit">Add item</button>
            </form>
        );
    }

    // if the user chooses to use exisiting food types
    function ExistingItems({ formState = {} , handleRequest }) {
        const {categoryList, 
            selectedCategory, setSelectedCategory, selectedFoodType, setSelectedFoodType, filteredFoodTypes
        } = formState;
        // the category list to render
        const CategoryList = () => {
            return (
                categoryList.map(category => (
                    <label key={category.id}>
                        <input
                            type="radio"
                            name="category"
                            value={category.id}
                            checked={selectedCategory?.id === category.id}
                            onChange={() => {
                                setSelectedCategory(category); // API contract change: keep the category id for POST /items.
                                setSelectedFoodType(null);
                            }}
                        /> {category.name}
                    </label>
                ))
            )
        }

        // the food type list to render
        const FoodTypeList = () => {
            return (
                filteredFoodTypes.map(ft => (
                    <label key={ft.id}>
                        <input
                            type="radio"
                            name="foodType"
                            value={ft.id}
                            checked={selectedFoodType?.id === ft.id}
                            onChange={() => setSelectedFoodType(ft)}
                        /> {ft.name}
                    </label>
                ))
            )
            
        }

        return (
            <div>
                {!selectedCategory && <CategoryList />}
                {selectedCategory && !selectedFoodType && (
                    <div>
                        <button onClick={() => setSelectedCategory(null)}>← Back</button>
                        <FoodTypeList />
                    </div>
                )}
                {selectedFoodType && (
                    <div>
                        <button onClick={() => setSelectedFoodType(null)}>← Back</button>
                        <FoodForm formState={formState} handleRequest={handleRequest}/>
                    </div>
                )}
            </div>
        )
    }


    

    
