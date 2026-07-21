import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { deleteItem, updateItem } from '../api/item';
import { Ban, Check, ChefHat, MoreHorizontal, Minus, Pencil, Plus, Trash2, Utensils } from 'lucide-react';

const urgentStatuses = new Set(['expired', 'expiring_today', 'expiring_soon']);

export default function ItemCard({ item, modalContainer, onItemDeleted, onItemUpdated, onEditItem }) {
    const navigate = useNavigate();
    const urgent = urgentStatuses.has(item.expiry_status);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showDisposeConfirmation, setShowDisposeConfirmation] = useState(false);
    const [showUseForm, setShowUseForm] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [usedQuantity, setUsedQuantity] = useState(1);
    const [useError, setUseError] = useState('');

    const currentQuantity = Number(item.quantity);
    const hasTrackableQuantity = Number.isFinite(currentQuantity) && currentQuantity > 0;

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

    const handleDisposed = async () => {
        await updateItem(item.id, { status: 'disposed' });
        onItemUpdated();
        setShowDisposeConfirmation(false);
    };

    const openUseForm = () => {
        setUsedQuantity(1);
        setUseError('');
        setShowUseForm(true);
        setShowMoreMenu(false);
    };

    const adjustUsedQuantity = (change) => {
        setUsedQuantity((value) => {
            const nextValue = Math.max(1, Number(value || 1) + change);
            return hasTrackableQuantity ? Math.min(nextValue, currentQuantity) : nextValue;
        });
        setUseError('');
    };

    const handleUsedQuantityChange = (event) => {
        const nextValue = Number(event.target.value);
        if (event.target.value === '') {
            setUsedQuantity('');
        } else if (hasTrackableQuantity && nextValue > currentQuantity) {
            setUsedQuantity(currentQuantity);
        } else {
            setUsedQuantity(event.target.value);
        }
        setUseError('');
    };

    const handleUseItem = async (event) => {
        event.preventDefault();

        const amountUsed = Number(usedQuantity);
        if (!hasTrackableQuantity) {
            setUseError('Set a quantity before using part of this item.');
            return;
        }
        if (!Number.isInteger(amountUsed) || amountUsed <= 0) {
            setUseError('Enter a whole number greater than 0.');
            return;
        }
        if (amountUsed === currentQuantity) {
            await updateItem(item.id, { status: 'consumed' });
            onItemUpdated();
            setShowUseForm(false);
            return;
        }

        await updateItem(item.id, { quantity: currentQuantity - amountUsed });
        onItemUpdated();
        setShowUseForm(false);
    };

    return (
        <article className={`item-card panel ${urgent ? 'urgent' : ''} ${showMoreMenu ? 'menu-open' : ''}`}>
            <div className="item-main">
                <div>
                    <h3>{item.name}</h3>
                    <p>{item.quantity ?? '-'} {item.unit || ''} / {item.storage || 'No storage set'}</p>
                </div>
                <div className="expiry-copy">
                    <strong>{item.expiry_date?.split('T')[0] ?? 'No expiry date'}</strong>
                    <small>{item.expiry_is_estimated ? 'Estimated expiry' : 'Expiry date'}</small>
                </div>
            </div>

            <div className="button-row item-actions">
                <button
                    className="icon-button item-action-button"
                    onClick={() => navigate(`/dashboard/recipes?ingredients=${item.food_type_id ?? ''}`)}
                    aria-label={`Find recipes for ${item.name}`}
                    title="Find recipes"
                >
                    <ChefHat size={18} />
                </button>
                <button className="button item-action-button text-icon-button secondary" onClick={() => setShowConfirmation(true)}>
                    <Check size={17} />
                    <span>Consume All</span>
                </button>
                <button className="button item-action-button text-icon-button secondary" onClick={openUseForm}>
                    <Utensils size={17} />
                    <span>Use</span>
                </button>
                <button className="button item-action-button text-icon-button danger" onClick={() => setShowDisposeConfirmation(true)}>
                    <Trash2 size={17} />
                    <span>Dispose</span>
                </button>
                <div className="more-menu-wrap">
                    <button
                        className="icon-button item-action-button"
                        onClick={() => setShowMoreMenu((visible) => !visible)}
                        aria-expanded={showMoreMenu}
                        aria-label={`More actions for ${item.name}`}
                        title="More"
                    >
                        <MoreHorizontal size={18} />
                    </button>
                    {showMoreMenu && (
                        <div className="more-menu">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMoreMenu(false);
                                    onEditItem(item);
                                }}
                            >
                                <Pencil size={16} />
                                <span>Edit item</span>
                            </button>
                            <button
                                type="button"
                                className="danger"
                                onClick={() => {
                                    setShowMoreMenu(false);
                                    handleDelete();
                                }}
                            >
                                <Ban size={16} />
                                <span>Delete item</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showUseForm && modalContainer instanceof Element && createPortal(
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowUseForm(false)}>
                    <section className="panel confirm-panel use-item-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <form onSubmit={handleUseItem}>
                            <div>
                                <h3>How many used?</h3>
                                <p>{item.name}</p>
                            </div>
                            <div className="quantity-stepper">
                                <button type="button" className="icon-button item-action-button" onClick={() => adjustUsedQuantity(-1)} aria-label="Decrease amount used">
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={hasTrackableQuantity ? currentQuantity : undefined}
                                    step="1"
                                    inputMode="numeric"
                                    value={usedQuantity}
                                    onChange={handleUsedQuantityChange}
                                    aria-label="Quantity used"
                                    autoFocus
                                />
                                <button type="button" className="icon-button item-action-button" onClick={() => adjustUsedQuantity(1)} aria-label="Increase amount used">
                                    <Plus size={16} />
                                </button>
                            </div>
                            {useError && <p className="message error">{useError}</p>}
                            <div className="button-row">
                                <button className="button" type="submit">Update</button>
                                <button className="button secondary" type="button" onClick={() => setShowUseForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>,
                modalContainer
            )}

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

            {showDisposeConfirmation && modalContainer instanceof Element && createPortal(
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowDisposeConfirmation(false)}>
                    <section className="panel confirm-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <p>Mark <strong>{item.name}</strong> as disposed?</p>
                        <div className="button-row">
                            <button className="button danger" onClick={handleDisposed}>Confirm</button>
                            <button className="button secondary" onClick={() => setShowDisposeConfirmation(false)}>Cancel</button>
                        </div>
                    </section>
                </div>,
                modalContainer
            )}
        </article>
    );
}
