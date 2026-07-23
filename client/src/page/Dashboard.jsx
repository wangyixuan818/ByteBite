import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Minus, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useAuthentication } from '../context/AuthenticationContext';
import { getItemList, updateItem } from '../api/item';
import { getFridges, initializeFridge } from '../api/fridge';
import { getNotifications, updateNotification } from '../api/notification';
import { AddItemForm } from '../components/AddItemForm';
import ItemList from '../components/ItemList';
import NotificationInbox from '../components/NotificationInbox';
import BrandTitle from '../components/BrandTitle';
import { searchByName } from '../utils/text';
import twoLayeredSheet from '../assets/bytebite-ui-v2/fridge/two-layered-sheet-v1.png';
import threeLayeredSheet from '../assets/bytebite-ui-v2/fridge/three-layered-sheet-v1.png';
import miniSheet from '../assets/bytebite-ui-v2/fridge/mini-sheet-v1.png';
import sideBySideSheet from '../assets/bytebite-ui-v2/fridge/side-by-side-sheet-v1.png';
import pantryShelf from '../assets/bytebite-ui-v2/fridge/pantry-open-shelf-v2.png';
import twoLayeredClosedIcon from '../assets/bytebite-ui-v2/fridge/two-layered-closed-icon.png';
import threeLayeredClosedIcon from '../assets/bytebite-ui-v2/fridge/three-layered-closed-icon.png';
import miniClosedIcon from '../assets/bytebite-ui-v2/fridge/mini-closed-icon.png';
import sideBySideClosedIcon from '../assets/bytebite-ui-v2/fridge/side-by-side-closed-icon.png';
import inventoryDisplayCombo from '../assets/bytebite-ui-v2/fridge/inventory-display-combo-v4.png';

const EXPIRY_STATUSES = new Set([
    'expired',
    'expiring_today',
    'expiring_soon',
    'expiring_this_week',
]);

const SECTION_TYPES = [
    { value: 'fridge', label: 'Fridge', guide: '0-4 C, everyday chilled food' },
    { value: 'fresh_zone', label: 'Fresh zone', guide: 'around 0 C, meat, seafood, produce' },
    { value: 'freezer', label: 'Freezer', guide: 'below -18 C, frozen storage' },
];

const STORAGE_FILTERS = [
    { value: 'fridge', label: 'Fridge' },
    { value: 'fresh zone', label: 'Fresh zone' },
    { value: 'freezer', label: 'Freezer' },
    { value: 'fridge door', label: 'Fridge door' },
    { value: 'pantry', label: 'Pantry' },
];

const EXPIRY_FILTERS = [
    { id: 'expired', label: 'Expired', statuses: ['expired'] },
    { id: 'expiring', label: 'Expiring soon', statuses: ['expiring_today', 'expiring_soon', 'expiring_this_week'] },
    { id: 'fresh', label: 'Fresh', statuses: ['ok'] },
    { id: 'no_date', label: 'No date', statuses: ['no_date'] },
];

const FRIDGE_MODELS = [
    {
        model_type: 'two_layered',
        label: 'Two layered',
        description: 'Freezer above, fridge below',
        image: twoLayeredSheet,
        closedIcon: twoLayeredClosedIcon,
        columns: 4,
        states: { closed: 0, open: 3 },
        sections: [
            { section_key: 'upper', name: 'Upper freezer', label: 'Upper section', section_type: 'freezer', has_door_space: true },
            { section_key: 'lower', name: 'Lower fridge', label: 'Lower section', section_type: 'fridge', has_door_space: true },
        ],
    },
    {
        model_type: 'three_layered',
        label: 'Three layered',
        description: 'Fridge, fresh zone, freezer drawer',
        image: threeLayeredSheet,
        closedIcon: threeLayeredClosedIcon,
        columns: 4,
        states: { closed: 0, open: 1 },
        sections: [
            { section_key: 'upper', name: 'Upper fridge', label: 'Upper section', section_type: 'fridge', has_door_space: true },
            { section_key: 'middle', name: 'Middle fresh zone', label: 'Middle section', section_type: 'fresh_zone', has_door_space: false },
            { section_key: 'lower', name: 'Lower freezer', label: 'Lower section', section_type: 'freezer', has_door_space: false },
        ],
    },
    {
        model_type: 'mini',
        label: 'Mini fridge',
        description: 'One compact chilled section',
        image: miniSheet,
        closedIcon: miniClosedIcon,
        columns: 2,
        states: { closed: 0, open: 1 },
        sections: [
            { section_key: 'main', name: 'Main fridge', label: 'Main section', section_type: 'fridge', has_door_space: true },
        ],
    },
    {
        model_type: 'side_by_side',
        label: 'Side-by-side',
        description: 'Freezer left, fridge right',
        image: sideBySideSheet,
        closedIcon: sideBySideClosedIcon,
        columns: 4,
        states: { closed: 0, open: 3 },
        sections: [
            { section_key: 'left', name: 'Left freezer', label: 'Left section', section_type: 'freezer', has_door_space: true },
            { section_key: 'right', name: 'Right fridge', label: 'Right section', section_type: 'fridge', has_door_space: true },
        ],
    },
];

const MODEL_BY_TYPE = Object.fromEntries(FRIDGE_MODELS.map(model => [model.model_type, model]));

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

function cloneDefaultSections(model) {
    return model.sections.map(section => ({ ...section }));
}

function sectionTypeLabel(type) {
    return SECTION_TYPES.find(sectionType => sectionType.value === type)?.label ?? 'Storage';
}

function storageFromSectionType(type, inDoor = false) {
    if (inDoor) return 'fridge door';
    if (type === 'fresh_zone') return 'fresh zone';
    if (type === 'freezer') return 'freezer';
    if (type === 'pantry') return 'pantry';
    return 'fridge';
}

function sectionDisplayName(section) {
    if (!section) return 'Storage';
    const cleaned = section.name?.replace(/_/g, ' ');
    return cleaned || `${section.section_key} ${sectionTypeLabel(section.section_type)}`;
}

function hotspotStyleForTarget(modelType, target) {
    if (target.id.startsWith('pantry:')) {
        return { left: '68%', top: '22%', width: '28%', height: '68%' };
    }

    const key = target.section.section_key;
    const baseByModel = {
        two_layered: {
            upper: { left: '5%', top: '8%', width: '57%', height: '30%' },
            lower: { left: '5%', top: '39%', width: '57%', height: '52%' },
        },
        three_layered: {
            upper: { left: '5%', top: '8%', width: '57%', height: '25%' },
            middle: { left: '5%', top: '35%', width: '57%', height: '20%' },
            lower: { left: '5%', top: '58%', width: '57%', height: '33%' },
        },
        mini: {
            main: { left: '10%', top: '12%', width: '50%', height: '76%' },
        },
        side_by_side: {
            left: { left: '4%', top: '12%', width: '29%', height: '78%' },
            right: { left: '34%', top: '12%', width: '29%', height: '78%' },
        },
    };

    const style = baseByModel[modelType]?.[key] ?? { left: '5%', top: '12%', width: '57%', height: '76%' };
    if (target.id.startsWith('door:')) {
        return { ...style, left: `calc(${style.left} + 34%)`, width: '22%' };
    }
    return style;
}

function FridgeSprite({ model, state = 'closed', className = '', label = '' }) {
    const frame = model.states[state] ?? 0;
    const columns = Math.max(model.columns, 1);
    const position = columns === 1 ? '50% 50%' : `${(frame / (columns - 1)) * 100}% 50%`;
    return (
        <span
            className={`fridge-sprite ${className}`}
            aria-label={label}
            role={label ? 'img' : undefined}
            style={{
                backgroundImage: `url(${model.image})`,
                backgroundSize: `${columns * 100}% 100%`,
                backgroundPosition: position,
            }}
        />
    );
}

export default function Dashboard() {
    const { user, logout } = useAuthentication();
    const navigate = useNavigate();
    const [itemList, setItemList] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [fridges, setFridges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fridgeLoading, setFridgeLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [inventoryMode, setInventoryMode] = useState('visualizer');
    const [activeInventoryView, setActiveInventoryView] = useState(null);
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
    const [selectedModelType, setSelectedModelType] = useState('two_layered');
    const [setupSections, setSetupSections] = useState(() => cloneDefaultSections(FRIDGE_MODELS[0]));
    const [fridgeName, setFridgeName] = useState('Home fridge');
    const [setupStarted, setSetupStarted] = useState(false);
    const [setupStep, setSetupStep] = useState('model');
    const [showTemperatureGuide, setShowTemperatureGuide] = useState(false);
    const [setupSubmitting, setSetupSubmitting] = useState(false);
    const [setupError, setSetupError] = useState('');
    const notificationSnoozeKey = useMemo(() => getNotificationSnoozeKey(user?.id), [user?.id]);
    const [dismissedNotificationKey, setDismissedNotificationKey] = useState(() => {
        const initialKey = getNotificationSnoozeKey(user?.id);
        return isNotificationSnoozed(initialKey) ? initialKey : '';
    });

    const activeFridge = fridges[0] ?? null;
    const activeModel = MODEL_BY_TYPE[activeFridge?.model_type] ?? MODEL_BY_TYPE[selectedModelType];
    const selectedModel = MODEL_BY_TYPE[selectedModelType];
    const hasInitializedFridge = Boolean(activeFridge);
    const fridgeSections = activeFridge?.sections?.filter(section => section.fridge_id) ?? [];
    const pantrySection = activeFridge?.sections?.find(section => !section.fridge_id && section.section_type === 'pantry') ?? null;

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
    const showNotificationPopup = unreadNotifications.length > 0 && !notificationPopupDismissed && hasInitializedFridge;

    const fridgeStorageOptions = useMemo(() => {
        if (!activeFridge) return [];
        return activeFridge.sections.flatMap(section => {
            const mainStorage = storageFromSectionType(section.section_type, false);
            const options = [{
                value: `section:${section.id}:main`,
                label: section.fridge_id ? sectionDisplayName(section) : 'Pantry',
                storage: mainStorage,
            }];
            if (section.has_door_space) {
                options.push({
                    value: `section:${section.id}:door`,
                    label: `${sectionDisplayName(section)} door`,
                    storage: 'fridge door',
                });
            }
            return options;
        });
    }, [activeFridge]);

    const sectionClickTargets = useMemo(() => {
        const targets = fridgeSections.map(section => ({
            id: `section:${section.id}`,
            label: sectionDisplayName(section),
            section,
        }));
        fridgeSections
            .filter(section => section.has_door_space)
            .forEach(section => targets.push({
                id: `door:${section.id}`,
                label: `${sectionDisplayName(section)} door`,
                section,
            }));
        if (pantrySection) {
            targets.push({ id: `pantry:${pantrySection.id}`, label: 'Pantry', section: pantrySection });
        }
        return targets;
    }, [fridgeSections, pantrySection]);

    const activeTarget = sectionClickTargets.find(target => target.id === activeInventoryView);

    const visibleInventoryItems = useMemo(() => {
        if (activeInventoryView === 'item' && focusedInventoryItemId) {
            return itemList.filter(item => item.id === focusedInventoryItemId);
        }
        if (!activeInventoryView || activeInventoryView === 'all') return itemList;
        if (!activeTarget) return itemList;

        return itemList.filter(item => {
            const sectionId = Number(activeTarget.section.id);
            const itemSectionId = Number(item.storage_section_id);
            const storage = item.storage;
            if (activeInventoryView.startsWith('pantry:')) {
                return itemSectionId === sectionId || (!item.storage_section_id && storage === 'pantry');
            }
            if (activeInventoryView.startsWith('door:')) {
                return (itemSectionId === sectionId && item.is_in_door) || (!item.storage_section_id && storage === 'fridge door');
            }
            const expectedStorage = storageFromSectionType(activeTarget.section.section_type, false);
            return (itemSectionId === sectionId && !item.is_in_door) || (!item.storage_section_id && storage === expectedStorage);
        });
    }, [activeInventoryView, activeTarget, focusedInventoryItemId, itemList]);

    const filteredInventoryItems = useMemo(() => {
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
    const focusedInventoryItem = itemList.find(item => item.id === focusedInventoryItemId);
    const inventoryTitle = activeInventoryView === 'item'
        ? focusedInventoryItem?.name ?? 'Item details'
        : activeInventoryView === 'all' || !activeInventoryView
            ? 'Full inventory'
            : activeTarget?.label ?? 'Inventory';

    const toggleInSet = (setter, value) => {
        setter(current => {
            const next = new Set(current);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    const resetInventoryFilters = () => {
        setSearchText('');
        setShowFilters(false);
        setExpiryFilter(new Set());
        setStorageFilter(new Set());
    };

    const openInventory = (view = 'all') => {
        setActiveInventoryView(view);
        setFocusedInventoryItemId(null);
    };

    const closeInventory = () => {
        setActiveInventoryView(null);
        resetInventoryFilters();
    };

    const countItemsForTarget = (target) => {
        if (!target) return itemList.length;
        if (target.id.startsWith('pantry:')) {
            return itemList.filter(item => Number(item.storage_section_id) === Number(target.section.id) || (!item.storage_section_id && item.storage === 'pantry')).length;
        }
        if (target.id.startsWith('door:')) {
            return itemList.filter(item => Number(item.storage_section_id) === Number(target.section.id) && item.is_in_door).length;
        }
        return itemList.filter(item => Number(item.storage_section_id) === Number(target.section.id) && !item.is_in_door).length;
    };

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

    const fetchFridges = async () => {
        setFridgeLoading(true);
        try {
            const res = await getFridges();
            setFridges(res.data);
        } catch {
            setError('Failed to load your fridge setup. Check that the server is running, then try again.');
        } finally {
            setFridgeLoading(false);
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
        fetchItems();
        fetchFridges();
        fetchNotifications();
    }, []);

    const showTemporaryMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    const selectModel = (modelType) => {
        const model = MODEL_BY_TYPE[modelType];
        setSelectedModelType(modelType);
        setSetupSections(cloneDefaultSections(model));
        setSetupError('');
    };

    const setupStepIndex = ['model', 'sections', 'name'].indexOf(setupStep);

    const goToNextSetupStep = () => {
        if (setupStep === 'model') setSetupStep('sections');
        if (setupStep === 'sections') setSetupStep('name');
    };

    const goToPreviousSetupStep = () => {
        if (setupStep === 'name') setSetupStep('sections');
        if (setupStep === 'sections') setSetupStep('model');
    };

    const updateSetupSection = (index, field, value) => {
        setSetupSections(current => current.map((section, sectionIndex) => (
            sectionIndex === index ? { ...section, [field]: value } : section
        )));
    };

    const submitFridgeSetup = async (event) => {
        event.preventDefault();
        setSetupSubmitting(true);
        setSetupError('');
        try {
            await initializeFridge({
                name: fridgeName.trim() || 'Home fridge',
                model_type: selectedModelType,
                sections: setupSections.map((section, index) => ({
                    section_key: section.section_key,
                    name: `${section.label.replace(' section', '')} ${sectionTypeLabel(section.section_type)}`,
                    section_type: section.section_type,
                    has_door_space: section.has_door_space,
                    position: index,
                })),
            });
            await Promise.all([fetchFridges(), fetchItems()]);
            showTemporaryMessage('Fridge added. Your inventory is ready.');
        } catch (err) {
            setSetupError(err.response?.data?.error?.message || 'Could not create the fridge yet. Please try again.');
        } finally {
            setSetupSubmitting(false);
        }
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

    const renderInventoryTools = () => (
        <>
            <div className="inventory-search">
                <div className="inventory-search-pill">
                    <input
                        type="text"
                        className="inventory-search-input"
                        value={searchText}
                        onChange={event => setSearchText(event.target.value)}
                        placeholder="Search items by name..."
                        autoFocus={Boolean(activeInventoryView)}
                    />
                    <span className="inventory-search-icon" aria-hidden="true"><Search size={20} /></span>
                </div>
                <button
                    type="button"
                    className={`inventory-filter-button${showFilters ? ' is-active' : ''}`}
                    aria-label="Filter items"
                    aria-pressed={showFilters}
                    onClick={() => setShowFilters(v => !v)}
                >
                    <SlidersHorizontal size={22} />
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
                            {STORAGE_FILTERS.map(filter => (
                                <button
                                    key={filter.value}
                                    type="button"
                                    className={`filter-chip${storageFilter.has(filter.value) ? ' is-selected' : ''}`}
                                    onClick={() => toggleInSet(setStorageFilter, filter.value)}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {activeFilterCount > 0 && (
                        <button type="button" className="filter-clear" onClick={() => { setExpiryFilter(new Set()); setStorageFilter(new Set()); }}>
                            Clear filters
                        </button>
                    )}
                </div>
            )}
        </>
    );

    const renderInventoryList = () => (
        loading ? (
            <p className="panel empty-state">Items loading...</p>
        ) : searchedItems.length === 0 ? (
            <p className="panel empty-state">
                {searchText ? `No items match "${searchText}".` : 'No items match these filters.'}
            </p>
        ) : (
            <ItemList
                itemList={searchedItems}
                onEditItem={openEditForm}
                onItemDeleted={() => refreshAfterItemChange('Item successfully deleted.')}
                onItemUpdated={() => refreshAfterItemChange('Item successfully updated.')}
            />
        )
    );

    const renderSetupEntry = () => (
        <section className="fridge-init-entry" aria-labelledby="fridge-entry-title">
            <div className="fridge-entry-art" aria-hidden="true">
                <img src={inventoryDisplayCombo} alt="" />
            </div>
            <p className="eyebrow">Fridge setup</p>
            <h1 id="fridge-entry-title">Your fridge is waiting</h1>
            <button className="button fridge-init-button" type="button" onClick={() => setSetupStarted(true)}>
                Initialize fridge
            </button>
        </section>
    );

    const renderSetup = () => (
        <section className="fridge-setup-shell" aria-labelledby="fridge-setup-title">
            <div className="fridge-wizard-header">
                <button
                    className="icon-button"
                    type="button"
                    aria-label={setupStep === 'model' ? 'Back to dashboard' : 'Back'}
                    onClick={() => setupStep === 'model' ? setSetupStarted(false) : goToPreviousSetupStep()}
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="fridge-setup-intro">
                    <p className="eyebrow">Step {setupStepIndex + 1} of 3</p>
                    <h1 id="fridge-setup-title">
                        {setupStep === 'model' && 'Choose model'}
                        {setupStep === 'sections' && 'Customize sections'}
                        {setupStep === 'name' && 'Name your fridge'}
                    </h1>
                </div>
                <div className="wizard-progress" aria-label="Fridge setup progress">
                    {['model', 'sections', 'name'].map((step, index) => (
                        <span key={step} className={index <= setupStepIndex ? 'is-active' : ''} />
                    ))}
                </div>
            </div>

            {setupStep === 'model' && (
                <>
                    <p className="wizard-copy">Pick the illustration closest to your real fridge. You can adjust the sections next.</p>
                    <div className="fridge-model-grid" aria-label="Fridge models">
                        {FRIDGE_MODELS.map(model => (
                            <button
                                key={model.model_type}
                                type="button"
                                className={`fridge-model-card${selectedModelType === model.model_type ? ' is-selected' : ''}`}
                                onClick={() => selectModel(model.model_type)}
                            >
                                <span className="model-card-art">
                                    <img src={model.closedIcon} alt="" />
                                </span>
                                <strong>{model.label}</strong>
                                <small>{model.description}</small>
                            </button>
                        ))}
                    </div>
                    <div className="wizard-actions">
                        <button className="button" type="button" onClick={goToNextSetupStep}>Next</button>
                    </div>
                </>
            )}

            {setupStep === 'sections' && (
                <>
                    <div className="fridge-customize-grid">
                        <div className="setup-preview">
                            <div className="setup-preview-combo">
                                <img src={selectedModel.closedIcon} alt={`${selectedModel.label} preview`} className="setup-fridge-icon" />
                            </div>
                        </div>

                        <div className="setup-controls">
                            <div className="section-heading compact">
                                <div>
                                    <p className="eyebrow">{selectedModel.label}</p>
                                    <h2>Set each storage area</h2>
                                </div>
                                <button
                                    className="icon-button help-icon-button"
                                    type="button"
                                    aria-label="Show temperature guide"
                                    aria-expanded={showTemperatureGuide}
                                    onClick={() => setShowTemperatureGuide(value => !value)}
                                >
                                    <HelpCircle size={18} />
                                </button>
                            </div>

                            {showTemperatureGuide && (
                                <div className="storage-guide">
                                    {SECTION_TYPES.map(sectionType => (
                                        <span key={sectionType.value}>
                                            <strong>{sectionType.label}</strong>
                                            <small>{sectionType.guide}</small>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {setupSections.map((section, index) => (
                                <div className="section-control" key={section.section_key}>
                                    <label>
                                        {section.label}
                                        <select value={section.section_type} onChange={event => updateSetupSection(index, 'section_type', event.target.value)}>
                                            {SECTION_TYPES.map(sectionType => (
                                                <option value={sectionType.value} key={sectionType.value}>{sectionType.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="door-toggle">
                                        <input
                                            type="checkbox"
                                            checked={section.has_door_space}
                                            onChange={event => updateSetupSection(index, 'has_door_space', event.target.checked)}
                                        />
                                        <span>Door storage</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="wizard-actions">
                        <button className="button secondary" type="button" onClick={goToPreviousSetupStep}>Back</button>
                        <button className="button" type="button" onClick={goToNextSetupStep}>Next</button>
                    </div>
                </>
            )}

            {setupStep === 'name' && (
                <form className="fridge-name-step" onSubmit={submitFridgeSetup}>
                    <div className="setup-preview-combo name-preview">
                        <img src={selectedModel.closedIcon} alt={`${selectedModel.label} preview`} className="setup-fridge-icon" />
                    </div>
                    <label>
                        Fridge name
                        <input value={fridgeName} onChange={event => setFridgeName(event.target.value)} placeholder="Home fridge" required />
                    </label>
                    {setupError && <p className="message error" role="alert">{setupError}</p>}
                    <div className="wizard-actions">
                        <button className="button secondary" type="button" onClick={goToPreviousSetupStep}>Back</button>
                        <button className="button" type="submit" disabled={setupSubmitting}>
                            {setupSubmitting ? 'Adding fridge...' : 'Add fridge'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    );

    return (
        <main className="page-shell dashboard-page">
            <nav className="topbar">
                <BrandTitle />
                <div className="button-row">
                    <span>{user?.display_name}</span>
                    <button className="button secondary" onClick={logout}>Log out</button>
                </div>
            </nav>

            {fridgeLoading ? (
                <section className="fridge-setup-shell panel">
                    <p className="empty-state">Loading your fridge...</p>
                </section>
            ) : !hasInitializedFridge ? (
                <>
                    {message && <p className="message success" role="status">{message}</p>}
                    {error && <p className="message error" role="alert">{error}</p>}
                    {setupStarted ? renderSetup() : renderSetupEntry()}
                </>
            ) : (
                <>
                    <header className="dashboard-header">
                        <div><p className="eyebrow">Dashboard</p><h1>Your fridge</h1></div>
                        <div className="button-row">
                            <button className="button secondary" onClick={() => navigate('/dashboard/recipes')}>Recipe Library</button>
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
                                    <h2 id="fridge-visual-title">{activeFridge?.name ?? 'Your fridge'}</h2>
                                </div>
                                <div className="visualizer-meta">
                                    <span>{itemList.length} item(s)</span>
                                    <div className="inventory-mode-toggle" role="group" aria-label="Inventory view">
                                        <button type="button" className={inventoryMode === 'visualizer' ? 'is-selected' : ''} onClick={() => { setInventoryMode('visualizer'); resetInventoryFilters(); }}>Visualizer</button>
                                        <button type="button" className={inventoryMode === 'list' ? 'is-selected' : ''} onClick={() => { setInventoryMode('list'); resetInventoryFilters(); }}>List</button>
                                    </div>
                                </div>
                            </div>

                            {inventoryMode === 'visualizer' ? (
                                <button type="button" className="visualizer-stage" onClick={() => openInventory('all')}>
                                    <span className="visualizer-art-combo">
                                        <img src={inventoryDisplayCombo} alt={`${activeFridge?.name ?? 'Fridge'} and pantry`} className="visualizer-combo-art" />
                                    </span>
                                    <span className="visualizer-stage-copy">
                                        <strong>Tap anywhere to open inventory</strong>
                                        <small>Then choose a shelf, drawer, door, or pantry to focus.</small>
                                    </span>
                                </button>
                            ) : (
                                <div className="fridge-visual">
                                    <button type="button" className="fridge-section full-inventory" onClick={() => openInventory('all')}>
                                        <span className="full-inventory-search" aria-hidden="true"><Search size={24} /></span>
                                        <span>View full list</span>
                                        <small>{itemList.length} total</small>
                                    </button>
                                    {sectionClickTargets.map(target => (
                                        <button
                                            type="button"
                                            className={`fridge-section ${target.section.section_type === 'freezer' ? 'freezer' : ''}${target.id.startsWith('pantry:') ? ' pantry' : ''}`}
                                            key={target.id}
                                            onClick={() => openInventory(target.id)}
                                        >
                                            <span>{target.label}</span>
                                            <small>{countItemsForTarget(target)} item(s)</small>
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
                </>
            )}

            {showNotificationPopup && (
                <div className="modal-backdrop notification-popup-backdrop" role="presentation">
                    <section className="modal panel notification-popup" role="dialog" aria-modal="true" aria-labelledby="notification-popup-title">
                        <div className="notification-popup-art" aria-hidden="true"><span>!</span></div>
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
                                    <button className="small-action-button" type="button" onClick={() => markNotificationRead(notification)}>Mark read</button>
                                </li>
                            ))}
                        </ul>
                        <div className="notification-popup-actions">
                            <button className="button secondary" type="button" onClick={snoozeNotifications}>Snooze</button>
                            <button className="button" type="button" onClick={markAllNotificationsRead}>Mark all read</button>
                        </div>
                    </section>
                </div>
            )}

            {activeInventoryView && (
                <div className="modal-backdrop visualizer-backdrop" role="presentation" onMouseDown={closeInventory}>
                    <section className="modal panel inventory-modal visualizer-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Sorted by expiry date</p>
                                <h2 id="inventory-modal-title">{inventoryTitle}</h2>
                            </div>
                            <button className="icon-button" aria-label="Close" onClick={closeInventory}><X size={18} /></button>
                        </div>

                        {activeInventoryView !== 'item' && (
                            <div className="visualizer-modal-layout">
                                <div className={`visualizer-art-panel${activeInventoryView !== 'all' ? ' is-focused' : ''}`}>
                                    <div className="modal-art-combo">
                                        <FridgeSprite model={activeModel} state="open" className="modal-fridge-sprite" label={`${activeFridge?.name ?? 'Fridge'} open`} />
                                        <img src={pantryShelf} alt="Pantry open shelf" className="modal-pantry-art" />
                                        {sectionClickTargets.map(target => (
                                            <button
                                                key={`hotspot-${target.id}`}
                                                type="button"
                                                className={`visual-hotspot${activeInventoryView === target.id ? ' is-selected' : ''}`}
                                                style={hotspotStyleForTarget(activeFridge?.model_type, target)}
                                                aria-label={`Focus ${target.label}`}
                                                title={target.label}
                                                onClick={() => setActiveInventoryView(activeInventoryView === target.id ? 'all' : target.id)}
                                            >
                                                <span>{target.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="visual-zone-list">
                                        <button type="button" className={`visual-zone-chip${activeInventoryView === 'all' ? ' is-selected' : ''}`} onClick={() => openInventory('all')}>
                                            Full inventory <small>{itemList.length}</small>
                                        </button>
                                        {sectionClickTargets.map(target => (
                                            <button
                                                key={target.id}
                                                type="button"
                                                className={`visual-zone-chip${activeInventoryView === target.id ? ' is-selected' : ''}`}
                                                onClick={() => setActiveInventoryView(activeInventoryView === target.id ? 'all' : target.id)}
                                            >
                                                {target.label} <small>{countItemsForTarget(target)}</small>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="visualizer-list-panel">
                                    {renderInventoryTools()}
                                    {renderInventoryList()}
                                </div>
                            </div>
                        )}

                        {activeInventoryView === 'item' && (
                            <>
                                {renderInventoryTools()}
                                {renderInventoryList()}
                            </>
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
                            <button className="icon-button" aria-label="Close" onClick={closeForm}><X size={18} /></button>
                        </div>
                        <AddItemForm
                            itemToEdit={editingItem}
                            storageOptions={fridgeStorageOptions}
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
