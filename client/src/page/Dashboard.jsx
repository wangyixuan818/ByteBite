import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useAuthentication } from '../context/AuthenticationContext';
import { getItemList, updateItem } from '../api/item';
import { getNotifications, updateNotification } from '../api/notification';
import { AddItemForm } from '../components/AddItemForm';
import ItemList from '../components/ItemList';
import NotificationInbox from '../components/NotificationInbox';
import BrandTitle from '../components/BrandTitle';

const EXPIRY_STATUSES = new Set([
    'expired',
    'expiring_today',
    'expiring_soon',
    'expiring_this_week',
]);

const STORAGE_SECTIONS = [
    { id: 'fridge', label: 'Fridge main', storageValues: ['fridge'] },
    { id: 'fresh-zone', label: 'Fresh zone', storageValues: ['fresh zone'] },
    { id: 'fridge-door', label: 'Fridge door', storageValues: ['fridge door'] },
    { id: 'freezer', label: 'Freezer', storageValues: ['freezer'] },
    { id: 'pantry', label: 'Pantry', storageValues: ['pantry'] },
];

function todayKey() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getNotificationSnoozeKey(userId) {
    return `bytebite-notification-snoozed:${userId ?? 'guest'}:${todayKey()}`;
}

function isNotificationSnoozed(key) {
    return sessionStorage.getItem(key) === 'true';
}

export default function Dashboard() {
    const { user, logout } = useAuthentication();
    const navigate = useNavigate();
    const [itemList, setItemList] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [activeInventoryView, setActiveInventoryView] = useState(null);
    const [focusedInventoryItemId, setFocusedInventoryItemId] = useState(null);
    const [bulkConsumeOpen, setBulkConsumeOpen] = useState(false);
    const [consumeItemTarget, setConsumeItemTarget] = useState(null);
    const [useItemTarget, setUseItemTarget] = useState(null);
    const [usedQuantity, setUsedQuantity] = useState(1);
    const [useError, setUseError] = useState('');
    const [message, setMessage] = useState('');
    const notificationSnoozeKey = useMemo(() => getNotificationSnoozeKey(user?.id), [user?.id]);
    const [dismissedNotificationKey, setDismissedNotificationKey] = useState(() => {
        const initialKey = getNotificationSnoozeKey(user?.id);
        return isNotificationSnoozed(initialKey) ? initialKey : '';
    });

    const expiringItems = useMemo(
        () => itemList.filter(item => EXPIRY_STATUSES.has(item.expiry_status)),
        [itemList]
    );
    const unreadNotifications = useMemo(
        () => notifications.filter(notification => !notification.read_at),
        [notifications]
    );
    const notificationPopupDismissed =
        dismissedNotificationKey === notificationSnoozeKey || isNotificationSnoozed(notificationSnoozeKey);
    const showNotificationPopup = unreadNotifications.length > 0 && !notificationPopupDismissed;

    const activeSection = STORAGE_SECTIONS.find(section => section.id === activeInventoryView);

    const visibleInventoryItems = useMemo(() => {
        if (activeInventoryView === 'item' && focusedInventoryItemId) {
            return itemList.filter(item => item.id === focusedInventoryItemId);
        }
        if (!activeInventoryView || activeInventoryView === 'all') return itemList;
        return itemList.filter(item => activeSection?.storageValues.includes(item.storage));
    }, [activeInventoryView, activeSection, focusedInventoryItemId, itemList]);

    const focusedInventoryItem = itemList.find(item => item.id === focusedInventoryItemId);

    const inventoryTitle = activeInventoryView === 'item'
        ? focusedInventoryItem?.name ?? 'Item details'
        : activeInventoryView === 'all'
        ? 'Full inventory'
        : activeSection?.label ?? 'Inventory';

    const countItemsInSection = (section) => itemList.filter(item => section.storageValues.includes(item.storage)).length;

    const fetchItems = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getItemList({ sort: 'expiry_asc' });
            setItemList(res.data);
        } catch {
            setError('Failed to get items. Check that the server is running, then try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await getNotifications();
            setNotifications(res.data);
        } catch {
            setError('Failed to get notifications. Check that the server is running, then try again.');
        }
    };

    useEffect(() => {
        getItemList({ sort: 'expiry_asc' })
            .then(res => setItemList(res.data))
            .catch(() => setError('Failed to get items. Check that the server is running, then try again.'))
            .finally(() => setLoading(false));

        getNotifications()
            .then(res => setNotifications(res.data))
            .catch(() => setError('Failed to get notifications. Check that the server is running, then try again.'));
    }, []);

    const showTemporaryMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    const openAddForm = () => {
        setEditingItem(null);
        setShowForm(true);
    };

    const openEditForm = (item) => {
        setActiveInventoryView(null);
        setFocusedInventoryItemId(null);
        setEditingItem(item);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingItem(null);
    };

    const refreshAfterItemChange = (text) => {
        fetchItems();
        showTemporaryMessage(text);
    };

    const openFocusedItem = (item) => {
        setFocusedInventoryItemId(item.id);
        setActiveInventoryView('item');
    };

    const openUseItem = (item) => {
        setUseItemTarget(item);
        setUsedQuantity(1);
        setUseError('');
    };

    const closeUseItem = () => {
        setUseItemTarget(null);
        setUseError('');
    };

    const currentUseQuantity = Number(useItemTarget?.quantity);
    const hasTrackableUseQuantity = Number.isFinite(currentUseQuantity) && currentUseQuantity > 0;

    const adjustUsedQuantity = (change) => {
        setUsedQuantity((value) => {
            const nextValue = Math.max(1, Number(value || 1) + change);
            return hasTrackableUseQuantity ? Math.min(nextValue, currentUseQuantity) : nextValue;
        });
        setUseError('');
    };

    const handleUsedQuantityChange = (event) => {
        const nextValue = Number(event.target.value);
        if (event.target.value === '') {
            setUsedQuantity('');
        } else if (hasTrackableUseQuantity && nextValue > currentUseQuantity) {
            setUsedQuantity(currentUseQuantity);
        } else {
            setUsedQuantity(event.target.value);
        }
        setUseError('');
    };

    const consumeOneItem = async (item) => {
        await updateItem(item.id, { status: 'consumed' });
        await fetchItems();
        showTemporaryMessage(`${item.name} marked as consumed.`);
    };

    const confirmUseItem = async (event) => {
        event.preventDefault();
        const amountUsed = Number(usedQuantity);

        if (!hasTrackableUseQuantity) {
            setUseError('Set a quantity before using part of this item.');
            return;
        }
        if (!Number.isInteger(amountUsed) || amountUsed <= 0) {
            setUseError('Enter a whole number greater than 0.');
            return;
        }
        if (amountUsed === currentUseQuantity) {
            await consumeOneItem(useItemTarget);
            closeUseItem();
            return;
        }

        await updateItem(useItemTarget.id, { quantity: currentUseQuantity - amountUsed });
        await fetchItems();
        closeUseItem();
        showTemporaryMessage(`${useItemTarget.name} quantity updated.`);
    };

    const consumeAllExpiringItems = async () => {
        await Promise.all(expiringItems.map(item => updateItem(item.id, { status: 'consumed' })));
        await fetchItems();
        setBulkConsumeOpen(false);
        showTemporaryMessage('Expiring items marked as consumed.');
    };

    const markAllNotificationsRead = async () => {
        await Promise.all(unreadNotifications.map(notification => updateNotification(notification.id, { read: true })));
        await fetchNotifications();
        setDismissedNotificationKey(notificationSnoozeKey);
    };

    const markNotificationRead = async (notification) => {
        await updateNotification(notification.id, { read: true });
        await fetchNotifications();
    };

    const snoozeNotifications = () => {
        sessionStorage.setItem(notificationSnoozeKey, 'true');
        setDismissedNotificationKey(notificationSnoozeKey);
    };

    return (
        <main className="page-shell dashboard-page">
            <nav className="topbar">
                <BrandTitle />
                <div className="button-row">
                    <span>{user?.display_name}</span>
                    <button className="button secondary" onClick={logout}>Log out</button>
                </div>
            </nav>

            <header className="dashboard-header">
                <div><p className="eyebrow">Dashboard</p><h1>Your fridge</h1></div>
                <div className="button-row">
                    <button className="button secondary" onClick={() => navigate('/dashboard/recipes?mode=library')}>Recipe Library</button>
                    <button className="button" onClick={openAddForm}>+ Add item</button>
                </div>
            </header>

            {message && <p className="message success" role="status">{message}</p>}
            {error && <p className="message error" role="alert">{error}</p>}

            <section className="dashboard-grid">
                <section className="panel fridge-panel" aria-labelledby="fridge-visual-title">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Storage visualizer</p>
                            <h2 id="fridge-visual-title">Open a section</h2>
                        </div>
                        <span>{itemList.length} item(s)</span>
                    </div>

                    <div className="fridge-visual">
                        <button type="button" className="fridge-section full-inventory" onClick={() => setActiveInventoryView('all')}>
                            <span>View full inventory</span>
                            <small>{itemList.length} total</small>
                        </button>
                        {STORAGE_SECTIONS.map(section => (
                            <button
                                type="button"
                                className={`fridge-section ${section.id}`}
                                key={section.id}
                                onClick={() => setActiveInventoryView(section.id)}
                            >
                                <span>{section.label}</span>
                                <small>{countItemsInSection(section)} item(s)</small>
                            </button>
                        ))}

                    </div>
                </section>

                <NotificationInbox
                    expiringItems={expiringItems}
                    onViewSuggestions={() => navigate('/dashboard/recipes?mode=expiry-suggestion')}
                    onConsumeAll={() => setBulkConsumeOpen(true)}
                    onConsumeItem={setConsumeItemTarget}
                    onUseItem={openUseItem}
                    onViewItem={openFocusedItem}
                />
            </section>

            {showNotificationPopup && (
                <div className="modal-backdrop notification-popup-backdrop" role="presentation">
                    <section className="modal panel notification-popup" role="dialog" aria-modal="true" aria-labelledby="notification-popup-title">
                        <div className="notification-popup-art" aria-hidden="true">
                            <span>!</span>
                        </div>
                        <div>
                            <p className="eyebrow">Today&apos;s reminder</p>
                            <h2 id="notification-popup-title">Use these soon</h2>
                            <p className="notification-popup-copy">Fresh alerts for food entering the expiry window.</p>
                        </div>

                        <ul className="notification-popup-list">
                            {unreadNotifications.map(notification => (
                                <li key={notification.id}>
                                    <div>
                                        <strong>{notification.message}</strong>
                                        <small>{notification.notification_date?.split('T')[0] ?? notification.created_at?.split('T')[0]}</small>
                                    </div>
                                    <button className="small-action-button" type="button" onClick={() => markNotificationRead(notification)}>
                                        Mark read
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="notification-popup-actions">
                            <button className="button secondary" type="button" onClick={snoozeNotifications}>
                                Snooze
                            </button>
                            <button className="button" type="button" onClick={markAllNotificationsRead}>
                                Mark all read
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {activeInventoryView && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => {
                    setActiveInventoryView(null);
                    setFocusedInventoryItemId(null);
                }}>
                    <section className="modal panel inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Sorted by expiry date</p>
                                <h2 id="inventory-modal-title">{inventoryTitle}</h2>
                            </div>
                            <button className="icon-button" aria-label="Close" onClick={() => {
                                setActiveInventoryView(null);
                                setFocusedInventoryItemId(null);
                            }}>×</button>
                        </div>

                        {loading ? <p className="panel empty-state">Items loading...</p> : (
                            <ItemList
                                itemList={visibleInventoryItems}
                                onEditItem={openEditForm}
                                onItemDeleted={() => refreshAfterItemChange('Item successfully deleted.')}
                                onItemUpdated={() => refreshAfterItemChange('Item successfully updated.')}
                            />
                        )}
                    </section>
                </div>
            )}

            {bulkConsumeOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setBulkConsumeOpen(false)}>
                    <section className="panel confirm-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <p>Mark all <strong>{expiringItems.length}</strong> expiring item(s) as consumed?</p>
                        <div className="button-row">
                            <button className="button" onClick={consumeAllExpiringItems}>Confirm</button>
                            <button className="button secondary" onClick={() => setBulkConsumeOpen(false)}>Cancel</button>
                        </div>
                    </section>
                </div>
            )}

            {consumeItemTarget && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setConsumeItemTarget(null)}>
                    <section className="panel confirm-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <p>Mark <strong>{consumeItemTarget.name}</strong> as consumed?</p>
                        <div className="button-row">
                            <button
                                className="button"
                                onClick={async () => {
                                    await consumeOneItem(consumeItemTarget);
                                    setConsumeItemTarget(null);
                                }}
                            >
                                Confirm
                            </button>
                            <button className="button secondary" onClick={() => setConsumeItemTarget(null)}>Cancel</button>
                        </div>
                    </section>
                </div>
            )}

            {useItemTarget && (
                <div className="modal-backdrop" role="presentation" onMouseDown={closeUseItem}>
                    <section className="panel confirm-panel use-item-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
                        <form onSubmit={confirmUseItem}>
                            <div>
                                <h3>How many used?</h3>
                                <p>{useItemTarget.name}</p>
                            </div>
                            <div className="quantity-stepper">
                                <button type="button" className="icon-button item-action-button" onClick={() => adjustUsedQuantity(-1)} aria-label="Decrease amount used">
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={hasTrackableUseQuantity ? currentUseQuantity : undefined}
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
                                <button className="button secondary" type="button" onClick={closeUseItem}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {showForm && (
                <div className="modal-backdrop" role="presentation" onMouseDown={closeForm}>
                    <section className="modal panel add-food-modal" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <h2 id="add-item-title">{editingItem ? 'Update food' : 'Add food'}</h2>
                            <button className="icon-button" aria-label="Close" onClick={closeForm}>×</button>
                        </div>
                        <AddItemForm
                            itemToEdit={editingItem}
                            onItemAdded={() => {
                                fetchItems();
                                closeForm();
                                showTemporaryMessage('Item successfully added.');
                            }}
                            onItemUpdated={() => {
                                fetchItems();
                                closeForm();
                                showTemporaryMessage('Item successfully updated.');
                            }}
                        />
                    </section>
                </div>
            )}
        </main>
    );
}
