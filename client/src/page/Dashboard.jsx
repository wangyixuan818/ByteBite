import { useEffect, useState} from 'react';
import { useAuthentication } from "../context/AuthenticationContext";
import { getItemList } from '../api/item';
import { AddItemForm } from '../components/AddItemForm';
import ItemCard from '../components/ItemCard';
import ItemList from '../components/ItemList';

export default function Dashboard() {
    const { user, logout } = useAuthentication();
    const [itemList, setItemList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("")
    const [showForm, setShowForm] = useState(false);
    const [addSuccess, setAddSuccess] = useState("");
    const [deleteSuccess, setDeleteSuccess] = useState("");

    const fetchItems = async () => { 
        setLoading(true);
        try {
        const res = await getItemList();
        setItemList(res.data);
        } catch (err) {
            setError("Failed to get items. Please try again.")
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchItems();
    }, [])

    return (
        <div>
            <h1>Welcome {user.display_name}</h1>
            <br />
            {deleteSuccess && <p>{deleteSuccess}</p>}
            {loading? <p>Items loading...</p> : <ItemList itemList={itemList} 
                                                        onItemDeleted={() => {
                                                            fetchItems();
                                                            setDeleteSuccess("Item successfully deleted");
                                                            setTimeout(() => setDeleteSuccess(""), 3000); // after 3 seconds
                                                        }}/>}
            <br />
            <button onClick={() => setShowForm(true)}>Add Item</button>
            {addSuccess && <p>{addSuccess}</p>}
            {error && <p>{error}</p>}
            {showForm && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', // dark overlay behind
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '8px',
                        width: '400px',
                    }}>
                        <button onClick={() => setShowForm(false)}>✕</button>
                        <AddItemForm onItemAdded={() => {
                                                fetchItems();
                                                setShowForm(false);
                                                setAddSuccess("Item successfully added!");
                                                setTimeout(() => setAddSuccess(""), 3000); //close after three seconds
                                            }} />
                    </div>
                </div>
            )}
            <br />
            <button onClick={logout}>Logout</button>
        </div>
    );
}