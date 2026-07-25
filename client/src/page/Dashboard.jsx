import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useAuthentication } from '../context/AuthenticationContext';
import { getItemList, updateItem } from '../api/item';
import { getNotifications, updateNotification } from '../api/notification';
import { getFridges, initializeFridge } from '../api/fridge';
import { getHouseholds, joinHousehold } from '../api/household';
import { AddItemForm } from '../components/AddItemForm';
import ItemList from '../components/ItemList';
import NotificationInbox from '../components/NotificationInbox';
import BrandTitle from '../components/BrandTitle';
import { searchByName } from '../utils/text';
import { getCurrentHouseholdId, setCurrentHouseholdId } from '../utils/currentHousehold';

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

const EXPIRY_FILTERS = [
    { id: 'expired', label: 'Expired', statuses: ['expired'] },
    { id: 'expiring', label: 'Expiring soon', statuses: ['expiring_today', 'expiring_soon', 'expiring_this_week'] },
    { id: 'fresh', label: 'Fresh', statuses: ['ok'] },
    { id: 'no_date', label: 'No date', statuses: ['no_date'] },
];

const FRIDGE_MODELS = [
    { id: 'two_layered', label: 'Two layered', detail: 'Freezer on top, fridge below' },
    { id: 'three_layered', label: 'Three layered', detail: 'Fridge, fresh zone, and freezer' },
    { id: 'mini', label: 'Mini fridge', detail: 'One compact fridge section' },
    { id: 'side_by_side', label: 'Side by side', detail: 'Freezer and fridge doors side by side' },
];

function StorageComboIcon({ className = '' }) {
    return (
        <span className={`storage-combo-icon ${className}`} aria-hidden="true">
            <span className="storage-combo-fridge">
                <span />
                <span />
                <span />
            </span>
            <span className="storage-combo-pantry">
                <span />
                <span />
                <span />
            </span>
        </span>
    );
}

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
    const [fridges, setFridges] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [inventoryPanelMode, setInventoryPanelMode] = useState('visual');
    const [activeInventoryView, setActiveInventoryView] = useState(null);
    const [inventoryOverlayKind, setInventoryOverlayKind] = useState('visual');
    const [searchText, setSearchText] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [expiryFilter, setExpiryFilter] = useState(() => new Set());
    const [storageFilter, setStorageFilter] = useState(() => new Set());
    const [focusedInventoryItemId, setFocusedInventoryItemId] = useState(null);
    const [bulkConsumeOpen, setBulkConsumeOpen] = useState(false);
    const [consumeItemTarget, setConsumeItemTarget] = useState(null);
    const [useItemTarget, setUseItemTarget] = useState(null);
    const [usedQuantity, setUsedQuantity] = useState(1);
    const [useError, setUseError] = useState('');
    const [message, setMessage] = useState('');
    const [setupBusy, setSetupBusy] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [showInitializeFridge, setShowInitializeFridge] = useState(false);
    const [fridgeName, setFridgeName] = useState('Home fridge');
    const [fridgeModel, setFridgeModel] = useState('two_layered');
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

    const filteredInventoryItems = useMemo(() => {
        // expand the selected expiry buckets into the raw statuses they cover
        const allowedStatuses = new Set(
            EXPIRY_FILTERS.filter(f => expiryFilter.has(f.id)).flatMap(f => f.statuses)
        );
        return visibleInventoryItems.filter(item => {
            const expiryOk = expiryFilter.size === 0 || allowedStatuses.has(item.expiry_status);
            const storageOk = storageFilter.size === 0 || storageFilter.has(item.storage);
            return expiryOk && storageOk;
        });
    }, [visibleInventoryItems, expiryFilter, storageFilter]);

    const searchedItems = useMemo(
        () => searchByName(filteredInventoryItems, searchText),
        [searchText, filteredInventoryItems]
    );

    const activeFilterCount = expiryFilter.size + storageFilter.size;
    const hasFridge = fridges.length > 0;

    const toggleInSet = (setter, value) => {
        setter(current => {
            const next = new Set(current);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    const openVisualInventory = () => {
        setInventoryOverlayKind('visual');
        setActiveInventoryView('all');
    };

    const openSectionInventory = (view, { filters = false } = {}) => {
        setInventoryOverlayKind('list');
        setShowFilters(filters);
        setActiveInventoryView(view);
    };

    const closeInventory = () => {
        setActiveInventoryView(null);
        setInventoryOverlayKind('visual');
        setSearchText('');
        setShowFilters(false);
        setExpiryFilter(new Set());
        setStorageFilter(new Set());
    };

    const focusedInventoryItem = itemList.find(item => item.id === focusedInventoryItemId);

    const inventoryTitle = activeInventoryView === 'item'
        ? focusedInventoryItem?.name ?? 'Item details'
        : activeInventoryView === 'all'
        ? 'Full inventory'
        : activeSection?.label ?? 'Inventory';

    const countItemsInSection = (section) => itemList.filter(item => section.storageValues.includes(item.storage)).length;

    const ensureCurrentHousehold = async () => {
        const storedHouseholdId = getCurrentHouseholdId();
        if (storedHouseholdId) return storedHouseholdId;

        const householdRes = await getHouseholds();
        const firstHouseholdId = householdRes.data.households?.[0]?.id ?? null;
        if (firstHouseholdId) setCurrentHouseholdId(firstHouseholdId);
        return firstHouseholdId;
    };

    const loadDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            const householdId = await ensureCurrentHousehold();
            if (!householdId) {
                setFridges([]);
                setItemList([]);
                setNotifications([]);
                return;
            }

            const fridgeRes = await getFridges();
            const nextFridges = fridgeRes.data ?? [];
            setFridges(nextFridges);

            if (nextFridges.length === 0) {
                setItemList([]);
                setNotifications([]);
                return;
            }

            const [itemRes, notificationRes] = await Promise.all([
                getItemList({ sort: 'expiry_asc' }),
                getNotifications(),
            ]);
            setItemList(itemRes.data);
            setNotifications(notificationRes.data);
        } catch {
            setError('Failed to load dashboard. Check that the server is running, then try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchItems = async () => {
        if (!hasFridge) return;
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
        if (!hasFridge) return;
        try {
            const res = await getNotifications();
            setNotifications(res.data);
        } catch {
            setError('Failed to get notifications. Check that the server is running, then try again.');
        }
    };

    useEffect(() => {
        let ignore = false;

        ensureCurrentHousehold()
            .then(householdId => {
                if (!householdId) return { fridges: [], items: [], notifications: [] };
                return getFridges().then(fridgeRes => {
                    const nextFridges = fridgeRes.data ?? [];
                    if (nextFridges.length === 0) {
                        return { fridges: nextFridges, items: [], notifications: [] };
                    }
                    return Promise.all([
                        getItemList({ sort: 'expiry_asc' }),
                        getNotifications(),
                    ]).then(([itemRes, notificationRes]) => ({
                        fridges: nextFridges,
                        items: itemRes.data,
                        notifications: notificationRes.data,
                    }));
                });
            })
            .then(data => {
                if (ignore) return;
                setFridges(data.fridges);
                setItemList(data.items);
                setNotifications(data.notifications);
            })
            .catch(() => {
                if (!ignore) setError('Failed to load dashboard. Check that the server is running, then try again.');
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    const showTemporaryMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    const openAddForm = () => {
        if (!hasFridge) {
            setShowInitializeFridge(true);
            return;
        }
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
        setInventoryOverlayKind('list');
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

    const handleInitializeFridge = async (event) => {
        event.preventDefault();
        if (!fridgeName.trim()) return;
        setSetupBusy(true);
        setError('');
        try {
            await initializeFridge({
                name: fridgeName.trim(),
                model_type: fridgeModel,
            });
            setShowInitializeFridge(false);
            showTemporaryMessage('Fridge initialized. Your household is ready.');
            await loadDashboardData();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not initialize this fridge.');
        } finally {
            setSetupBusy(false);
        }
    };

    const handleJoinHousehold = async (event) => {
        event.preventDefault();
        if (!joinCode.trim()) return;
        setSetupBusy(true);
        setError('');
        try {
            const res = await joinHousehold(joinCode.trim());
            setCurrentHouseholdId(res.data.household.id);
            setJoinCode('');
            showTemporaryMessage(`Joined ${res.data.household.name}.`);
            await loadDashboardData();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'That household code did not work.');
        } finally {
            setSetupBusy(false);
        }
    };

    return (
        <main className="page-shell dashboard-page">
            <nav className="topbar">
                <BrandTitle />
                <div className="button-row">
                    <button className="topbar-profile-link" type="button" onClick={() => navigate('/dashboard/profile')}>
                        <span className="topbar-profile-avatar" aria-hidden="true">
                            {(user?.display_name || 'B').trim().slice(0, 1).toUpperCase()}
                        </span>
                        <span>{user?.display_name}</span>
                    </button>
                    <button className="button secondary" onClick={logout}>Log out</button>
                </div>
            </nav>

            <header className="dashboard-header">
                <div><p className="eyebrow">Dashboard</p><h1>Your fridge</h1></div>
                <div className="button-row">
                    <button className="button secondary" onClick={() => navigate('/dashboard/recipes')}>Recipe Library</button>
                    {hasFridge && <button className="button" onClick={openAddForm}>+ Add item</button>}
                </div>
            </header>

            {message && <p className="message success" role="status">{message}</p>}
            {error && <p className="message error" role="alert">{error}</p>}

            {loading ? (
                <p className="panel empty-state dashboard-empty-panel">Loading dashboard...</p>
            ) : !hasFridge ? (
                <section className="panel fridge-setup-panel" aria-labelledby="fridge-setup-title">
                    <div className="fridge-setup-art" aria-hidden="true">
                        <StorageComboIcon className="storage-combo-icon-hero" />
                    </div>
                    <div className="fridge-setup-copy">
                        <p className="eyebrow">Household setup</p>
                        <h2 id="fridge-setup-title">Set up a fridge first</h2>
                        <p>This household does not have a fridge yet, so ByteBite is hiding inventory and expiry alerts until there is somewhere to store food.</p>
                        <div className="button-row">
                            <button className="button" type="button" onClick={() => setShowInitializeFridge(true)}>Initialize new fridge</button>
                            <button className="button secondary" type="button" onClick={() => navigate('/dashboard/profile')}>Manage households</button>
                        </div>
                    </div>
                    <form className="fridge-setup-join" onSubmit={handleJoinHousehold}>
                        <label htmlFor="dashboard-join-code">Join an existing household</label>
                        <div className="household-inline-control">
                            <input
                                id="dashboard-join-code"
                                value={joinCode}
                                onChange={event => setJoinCode(event.target.value.toUpperCase())}
                                placeholder="AB12CD34EF"
                            />
                            <button className="button secondary" type="submit" disabled={setupBusy || !joinCode.trim()}>Join</button>
                        </div>
                    </form>
                </section>
            ) : (
            <section className="dashboard-grid">
                <section className="panel fridge-panel" aria-labelledby="fridge-visual-title">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Storage visualizer</p>
                            <h2 id="fridge-visual-title">Open a section</h2>
                        </div>
                        <div className="visualizer-meta">
                            <span>{itemList.length} item(s)</span>
                            <div className="fridge-mode-toggle" role="group" aria-label="Inventory panel mode">
                                <button
                                    type="button"
                                    className={inventoryPanelMode === 'visual' ? 'is-active' : ''}
                                    aria-pressed={inventoryPanelMode === 'visual'}
                                    onClick={() => setInventoryPanelMode('visual')}
                                >
                                    Visual
                                </button>
                                <button
                                    type="button"
                                    className={inventoryPanelMode === 'sections' ? 'is-active' : ''}
                                    aria-pressed={inventoryPanelMode === 'sections'}
                                    onClick={() => setInventoryPanelMode('sections')}
                                >
                                    Sections
                                </button>
                            </div>
                            <button type="button" className="visualizer-filter-button" aria-label="Filter inventory" onClick={() => openSectionInventory('all', { filters: true })}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="8" x2="20" y2="8" />
                                    <circle cx="9" cy="8" r="2.6" fill="#faf6e6" />
                                    <line x1="4" y1="16" x2="20" y2="16" />
                                    <circle cx="15" cy="16" r="2.6" fill="#faf6e6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {inventoryPanelMode === 'visual' ? (
                        <div className="fridge-visual is-icon-mode">
                            <button type="button" className="fridge-section visual-inventory-entry" aria-label="Open full fridge and pantry inventory" onClick={openVisualInventory}>
                                <StorageComboIcon className="storage-combo-icon-hero" />
                            </button>
                        </div>
                    ) : (
                        <div className="fridge-visual">
                            <button type="button" className="fridge-section full-inventory" onClick={() => openSectionInventory('all')}>
                                <StorageComboIcon className="storage-combo-icon-tile" />
                                <span>View full inventory</span>
                                <small>{itemList.length} total</small>
                            </button>
                            {STORAGE_SECTIONS.map(section => (
                                <button
                                    type="button"
                                    className={`fridge-section ${section.id}`}
                                    key={section.id}
                                    onClick={() => openSectionInventory(section.id)}
                                >
                                    <span>{section.label}</span>
                                    <small>{countItemsInSection(section)} item(s)</small>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <NotificationInbox
                    expiringItems={expiringItems}
                    onViewSuggestions={() => {
                        const ids = [...new Set(
                            itemList
                                .filter(i => ['expiring_today', 'expiring_soon', 'expiring_this_week'].includes(i.expiry_status))
                                .map(i => Number(i.food_type_id))
                                .filter(Boolean)
                        )];
                        navigate(`/dashboard/recipes?ingredients=${ids.join(',')}`);
                    }}
                    onConsumeAll={() => setBulkConsumeOpen(true)}
                    onConsumeItem={setConsumeItemTarget}
                    onUseItem={openUseItem}
                    onViewItem={openFocusedItem}
                />
            </section>
            )}

            {hasFridge && showNotificationPopup && (
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

            {hasFridge && activeInventoryView && (
                <div className="inventory-stage-backdrop" role="presentation" onMouseDown={ closeInventory }>
                    <section className={`inventory-stage inventory-modal ${inventoryOverlayKind === 'visual' ? 'has-visualizer' : 'is-list-only'}`} role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title" onMouseDown={event => event.stopPropagation()}>
                        {inventoryOverlayKind === 'visual' && (
                            <div className="inventory-stage-visual">
                                <StorageComboIcon className="storage-combo-icon-expanded" />
                            </div>
                        )}
                        <div className="inventory-stage-content">
                            <div className="section-heading">
                            <div>
                                <p className="eyebrow">Sorted by expiry date</p>
                                <h2 id="inventory-modal-title">{inventoryTitle}</h2>
                            </div>
                            <button className="icon-button inventory-stage-close" aria-label="Close" onClick={ closeInventory }>x</button>
                            </div>

                            <div className="inventory-search">
                            <div className="inventory-search-pill">
                                <input
                                    type="text"
                                    className="inventory-search-input"
                                    value={searchText}
                                    onChange={event => setSearchText(event.target.value)}
                                    placeholder="Search items by name..."
                                    autoFocus
                                />
                                <span className="inventory-search-icon" aria-hidden="true">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="7" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </span>
                                <button type="button" className="inventory-search-mic" aria-label="Voice search (coming soon)" disabled>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="2" width="6" height="12" rx="3" />
                                        <path d="M5 10a7 7 0 0 0 14 0" />
                                        <line x1="12" y1="19" x2="12" y2="22" />
                                    </svg>
                                </button>
                            </div>
                            <button
                                type="button"
                                className={`inventory-filter-button${showFilters ? ' is-active' : ''}`}
                                aria-label="Filter items"
                                aria-pressed={showFilters}
                                onClick={() => setShowFilters(v => !v)}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="4" y1="8" x2="20" y2="8" />
                                    <circle cx="9" cy="8" r="2.6" fill="#faf6e6" />
                                    <line x1="4" y1="16" x2="20" y2="16" />
                                    <circle cx="15" cy="16" r="2.6" fill="#faf6e6" />
                                </svg>
                                {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
                            </button>
                        </div>

                        {showFilters && (
                            <div className="inventory-filters">
                                <div className="filter-group">
                                    <span className="filter-group-label">Expiry</span>
                                    <div className="filter-chips">
                                        {EXPIRY_FILTERS.map(f => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                className={`filter-chip${expiryFilter.has(f.id) ? ' is-selected' : ''}`}
                                                onClick={() => toggleInSet(setExpiryFilter, f.id)}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="filter-group">
                                    <span className="filter-group-label">Storage</span>
                                    <div className="filter-chips">
                                        {STORAGE_SECTIONS.map(section => {
                                            const value = section.storageValues[0];
                                            return (
                                                <button
                                                    key={section.id}
                                                    type="button"
                                                    className={`filter-chip${storageFilter.has(value) ? ' is-selected' : ''}`}
                                                    onClick={() => toggleInSet(setStorageFilter, value)}
                                                >
                                                    {section.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {activeFilterCount > 0 && (
                                    <button type="button" className="filter-clear" onClick={() => { setExpiryFilter(new Set()); setStorageFilter(new Set()); }}>
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        )}

                        {loading ? (

                            <p className="panel empty-state">Items loading...</p>
                        ) : searchedItems.length === 0 ? (
                            <p className="panel empty-state">
                                {searchText ? `No items match “${searchText}”.` : 'No items match these filters.'}
                            </p>
                        ) : (
                            <ItemList
                                itemList={searchedItems}
                                onEditItem={openEditForm}
                                onItemDeleted={() => refreshAfterItemChange('Item successfully deleted.')}
                                onItemUpdated={() => refreshAfterItemChange('Item successfully updated.')}
                            />
                        )}
                        </div>
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

            {showInitializeFridge && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowInitializeFridge(false)}>
                    <section className="modal panel initialize-fridge-modal" role="dialog" aria-modal="true" aria-labelledby="initialize-fridge-title" onMouseDown={event => event.stopPropagation()}>
                        <form className="form-stack" onSubmit={handleInitializeFridge}>
                            <div className="section-heading">
                                <div>
                                    <p className="eyebrow">Household fridge</p>
                                    <h2 id="initialize-fridge-title">Initialize fridge</h2>
                                </div>
                                <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowInitializeFridge(false)}>x</button>
                            </div>
                            <label>
                                Fridge name
                                <input value={fridgeName} onChange={event => setFridgeName(event.target.value)} required autoFocus />
                            </label>
                            <fieldset className="fridge-model-picker">
                                <legend>Fridge type</legend>
                                <div>
                                    {FRIDGE_MODELS.map(model => (
                                        <label key={model.id} className={fridgeModel === model.id ? 'is-selected' : ''}>
                                            <input
                                                type="radio"
                                                name="fridge-model"
                                                value={model.id}
                                                checked={fridgeModel === model.id}
                                                onChange={event => setFridgeModel(event.target.value)}
                                            />
                                            <span>
                                                <strong>{model.label}</strong>
                                                <small>{model.detail}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="button-row">
                                <button className="button" type="submit" disabled={setupBusy || !fridgeName.trim()}>
                                    {setupBusy ? 'Initializing...' : 'Initialize fridge'}
                                </button>
                                <button className="button secondary" type="button" onClick={() => setShowInitializeFridge(false)}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {hasFridge && showForm && (
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
