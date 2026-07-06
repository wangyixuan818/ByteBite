import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';
import { getItemList } from '../api/item';
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
        if (!activeInventoryView || activeInventoryView === 'all') return itemList;
        return itemList.filter(item => activeSection?.storageValues.includes(item.storage));
    }, [activeInventoryView, activeSection, itemList]);

    const inventoryTitle = activeInventoryView === 'all'
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
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveInventoryView(null)}>
                    <section className="modal panel inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Sorted by expiry date</p>
                                <h2 id="inventory-modal-title">{inventoryTitle}</h2>
                            </div>
                            <button className="icon-button" aria-label="Close" onClick={() => setActiveInventoryView(null)}>×</button>
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
