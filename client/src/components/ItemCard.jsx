import { useNavigate } from 'react-router-dom';
import { deleteItem, updateItem } from '../api/item';

const urgentStatuses = new Set(['expired', 'expiring_today', 'expiring_soon']);

export default function ItemCard({ item, onItemDeleted, onItemUpdated, onEditItem }) {
    const navigate = useNavigate();
    const urgent = urgentStatuses.has(item.expiry_status);

    const handleDelete = async () => {
        if (!window.confirm(`Delete ${item.name}?`)) return;
        await deleteItem(item.id);
        onItemDeleted();
    };

    const handleConsumed = async () => {
        if (!window.confirm(`Mark ${item.name} as consumed?`)) return;
        await updateItem(item.id, { status: 'consumed' });
        onItemUpdated();
    };

    return (
        <article className={`item-card panel ${urgent ? 'urgent' : ''}`}>
            <div className="item-main">
                <div>
                    <h3>{item.name}</h3>
                    <p>{item.quantity ?? '—'} {item.unit || ''} · {item.storage || 'No storage set'}</p>
                </div>
                <div className="expiry-copy">
                    <strong>{item.expiry_date?.split('T')[0] ?? 'No expiry date'}</strong>
                    <small>{item.expiry_is_estimated ? 'Estimated expiry' : 'Expiry date'}</small>
                </div>
            </div>

            <div className="button-row item-actions">
                <button className="button secondary" onClick={() => navigate(`/dashboard/recipes?item=${item.id}`)}>How can I use this?</button>
                <button className="button secondary" onClick={() => onEditItem(item)}>Update</button>
                <button className="button secondary" onClick={handleConsumed}>Consumed</button>
                <button className="button danger" onClick={handleDelete}>Delete</button>
            </div>
        </article>
    );
}
