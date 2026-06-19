import { deleteItem } from "../api/item";

export default function ItemCard({ item, onItemDeleted }) {
    const cardStyle = {
        border: '1px solid #ccc',
        backgroundColor: '#84c765',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '0.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    }

    const nameStyle = {
        fontWeight: 'bold',
        fontSize: '1rem',
        color: "#ffffff"
    }

    const expiryStyle = {
        fontSize: '0.85rem',
        color: '#ffffff',
    }

    const deleteButtonStyle = {
        backgroundColor: '#000000',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '0.25rem 0.75rem',
        cursor: 'pointer',
    }

    const handleDelete = async () => {
        try {
            await deleteItem(item.id); // API contract change: DELETE /items/:id returns 204 No Content, so no response body is read.
            onItemDeleted();
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div style={cardStyle}>
            <div>
                <p style={nameStyle}>{item.name}</p>
            <p style={expiryStyle}>Expires: {item.expiry_date?.split('T')[0] ?? 'Unknown'}</p>
            </div>
            <button style={deleteButtonStyle} onClick={handleDelete}>Delete Item</button>
        </div>
    );
}
