    import { addItem, getFoodTypes } from '../api/item';
    import { useEffect, useState } from "react";

    export const AddItemForm = ({ onItemAdded }) => {
        const [isCustom, setIsCustom] = useState(false);
        const [name, setName] = useState("");
        const [quantity, setQuantity] = useState(1);
        const [unit, setUnit] = useState("");
        const [storage, setStorage] = useState("fridge"); // TODO: change after categories are updated 
        const [expiryDate, setExpiryDate] = useState(""); //idk how to assign date format
        const [foodTypeList, setFoodTypeList] = useState([]);
        useEffect(() => {
            getFoodTypes().then(res => setFoodTypeList(res.data));
        }, [])
        const uniqueCategories = [...new Set(foodTypeList.map(item => item.category))];
        const [selectedCategory, setSelectedCategory] = useState(null);
        const [selectedFoodType, setSelectedFoodType] = useState(null);
        const filteredFoodTypes = foodTypeList.filter(ft => ft.category === selectedCategory);
        const [error, setError] = useState("");
        const formState = {name, setName, quantity, setQuantity, unit, setUnit, 
            storage, setStorage, expiryDate, setExpiryDate, 
            foodTypeList, setFoodTypeList, uniqueCategories, 
            selectedCategory, setSelectedCategory, selectedFoodType, setSelectedFoodType, filteredFoodTypes
        }


        const handleRequest = async (e) => {
            e.preventDefault();
            
            try {
                await addItem({
                    name,
                    quantity,
                    unit: unit || undefined, 
                    storage,
                    expiry_date: expiryDate || undefined,
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
                let date = new Date();
                date.setDate(date.getDate() + selectedFoodType.default_shelf_life_days);
                setExpiryDate(date.toISOString().split('T')[0]); 
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
                    <option value="" disabled hidden>Store in...</option>
                    <option value="fridge">Fridge</option>
                    <option value="fresh zone">Fresh Zone</option>
                    <option value="freezer">Freezer</option>
                    <option value="fridge door">Fridge Door</option>
                    <option value="pantry">Pantry</option>
                </select>
                {/*TODO: update the options after categories for storage are changed (according to discussion) */}
                <br />
                <input type="date" value={expiryDate} placeholder="Expiry date" onChange={e => setExpiryDate(e.target.value)} />
                <br />
                <button type="submit">Add item</button>
            </form>
        );
    }

    // if the user chooses to use exisiting food types
    function ExistingItems({ formState = {} , handleRequest }) {
        const {foodTypeList, setFoodTypeList, uniqueCategories, 
            selectedCategory, setSelectedCategory, selectedFoodType, setSelectedFoodType, filteredFoodTypes
        } = formState;
        // the category list to render
        const CategoryList = () => {
            return (
                uniqueCategories.map(category => (
                    <label key={category}>
                        <input
                            type="radio"
                            name="category"
                            value={category}
                            checked={selectedCategory === category}
                            onChange={() => setSelectedCategory(category)}
                        /> {category}
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


    

    