import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { deleteItem, updateItem } from '../api/item';

const urgentStatuses = new Set(['expired', 'expiring_today', 'expiring_soon']);

export default function ItemCard({ item, modalContainer, onItemDeleted, onItemUpdated, onEditItem }) {
    const navigate = useNavigate();
    const urgent = urgentStatuses.has(item.expiry_status);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm(`Delete ${item.name}?`)) return;
        await deleteItem(item.id);
        onItemDeleted();
    };

    const handleConsumed = async () => {
        await updateItem(item.id, { status: 'consumed' });
        onItemUpdated();
        setShowConfirmation(false);
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
                <button className="button secondary" onClick={() => navigate(`/dashboard/recipes?ingredients=${item.food_type_id ?? ''}`)}>How can I use this?</button>
                <button className="button secondary" onClick={() => onEditItem(item)}>Update</button>
                <button className="button secondary" onClick={() => setShowConfirmation(true)}>Consumed</button>
                <button className="button danger" onClick={handleDelete}>Delete</button>
            </div>

            {showConfirmation && modalContainer instanceof Element && createPortal(
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowConfirmation(false)}>
                    <section className="panel confirm-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <p>Mark <strong>{item.name}</strong> as consumed?</p>
                        <div className="button-row">
                            <button className="button" onClick={handleConsumed}>Confirm</button>
                            <button className="button secondary" onClick={() => setShowConfirmation(false)}>Cancel</button>
                        </div>
                    </section>
                </div>,
                modalContainer
            )}
        </article>
    );
}
