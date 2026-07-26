import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import twoLayeredFridgeImage from '../assets/bytebite-ui-v2/fridges/two-layered-closed.png';
import threeLayeredFridgeImage from '../assets/bytebite-ui-v2/fridges/three-layered-closed.png';
import miniFridgeImage from '../assets/bytebite-ui-v2/fridges/mini-closed.png';
import sideBySideFridgeImage from '../assets/bytebite-ui-v2/fridges/side-by-side-closed.png';
import twoLayeredVisualizerImage from '../assets/bytebite-ui-v2/fridges/visualizer-two-layered-pantry.png';
import threeLayeredVisualizerImage from '../assets/bytebite-ui-v2/fridges/visualizer-three-layered-pantry.png';
import miniVisualizerImage from '../assets/bytebite-ui-v2/fridges/visualizer-mini-pantry.png';
import sideBySideVisualizerImage from '../assets/bytebite-ui-v2/fridges/visualizer-side-by-side-pantry.png';
import twoLayeredAllOpenImage from '../assets/bytebite-ui-v2/fridges/two-layered-all-open-pantry.png';
import twoLayeredUpperOpenImage from '../assets/bytebite-ui-v2/fridges/two-layered-upper-open-pantry.png';
import twoLayeredLowerOpenImage from '../assets/bytebite-ui-v2/fridges/two-layered-lower-open-pantry.png';

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

const STORAGE_TYPE_OPTIONS = [
    { id: 'fridge', label: 'Fridge', temperature: '0-4 C', examples: 'Milk, leftovers, sauces' },
    { id: 'fresh_zone', label: 'Fresh zone', temperature: 'Around 0 C', examples: 'Meat, fish, leafy greens' },
    { id: 'freezer', label: 'Freezer', temperature: 'Below -18 C', examples: 'Frozen meals, dumplings, ice cream' },
];

const CURRENT_FRIDGE_KEY = 'bytebite-current-fridge-id';

function getCurrentFridgeId() {
    return localStorage.getItem(CURRENT_FRIDGE_KEY);
}

function setCurrentFridgeId(fridgeId) {
    if (fridgeId) {
        localStorage.setItem(CURRENT_FRIDGE_KEY, String(fridgeId));
    } else {
        localStorage.removeItem(CURRENT_FRIDGE_KEY);
    }
}

const FRIDGE_MODELS = [
    {
        id: 'two_layered',
        label: 'Two-layer fridge',
        detail: 'A freezer above a larger fridge section.',
        image: twoLayeredFridgeImage,
        sections: [
            { section_key: 'upper', name: 'Upper section', section_type: 'freezer', has_door_space: true },
            { section_key: 'lower', name: 'Lower section', section_type: 'fridge', has_door_space: true },
        ],
    },
    {
        id: 'three_layered',
        label: 'Three-layer fridge',
        detail: 'Three door sections for chilled, fresh, and frozen food.',
        image: threeLayeredFridgeImage,
        sections: [
            { section_key: 'upper', name: 'Upper section', section_type: 'fridge', has_door_space: true },
            { section_key: 'middle', name: 'Middle section', section_type: 'fresh_zone', has_door_space: true },
            { section_key: 'lower', name: 'Lower section', section_type: 'freezer', has_door_space: true },
        ],
    },
    {
        id: 'mini',
        label: 'Mini fridge',
        detail: 'One compact section for drinks and small groceries.',
        image: miniFridgeImage,
        sections: [
            { section_key: 'main', name: 'Main section', section_type: 'fridge', has_door_space: true },
        ],
    },
    {
        id: 'side_by_side',
        label: 'Side-by-side fridge',
        detail: 'Freezer and fridge sections next to each other.',
        image: sideBySideFridgeImage,
        sections: [
            { section_key: 'left', name: 'Left section', section_type: 'freezer', has_door_space: true },
            { section_key: 'right', name: 'Right section', section_type: 'fridge', has_door_space: true },
        ],
    },
];

const FRIDGE_VISUALIZER_IMAGES = {
    two_layered: twoLayeredVisualizerImage,
    three_layered: threeLayeredVisualizerImage,
    mini: miniVisualizerImage,
    side_by_side: sideBySideVisualizerImage,
};

const FRIDGE_STATE_IMAGES = {
    two_layered: {
        'all-open': twoLayeredAllOpenImage,
        'upper-fridge': twoLayeredUpperOpenImage,
        'upper-door': twoLayeredUpperOpenImage,
        'lower-fridge': twoLayeredLowerOpenImage,
        'lower-door': twoLayeredLowerOpenImage,
        pantry: twoLayeredAllOpenImage,
    },
};

const FRIDGE_VIEW_CONFIG = {
    'all-open': {
        scale: 1,
        x: '0%',
        y: '0%',
        inventoryLocation: null,
        label: 'Full inventory',
        imageLabel: 'Full open fridge and pantry',
    },
    'upper-door': {
        scale: 1.72,
        x: '13%',
        y: '10%',
        inventoryLocation: 'upper-door',
        sectionKey: 'upper',
        isDoor: true,
        label: 'Upper door',
        imageLabel: 'Upper fridge door',
        hotspot: { left: '16%', top: '13%', width: '17%', height: '24%', markerLeft: '46%', markerTop: '53%' },
    },
    'upper-fridge': {
        scale: 1.68,
        x: '-13%',
        y: '11%',
        inventoryLocation: 'upper-fridge',
        sectionKey: 'upper',
        isDoor: false,
        label: 'Upper section',
        imageLabel: 'Upper fridge section',
        hotspot: { left: '33%', top: '13%', width: '26%', height: '25%', markerLeft: '41%', markerTop: '52%' },
    },
    'lower-door': {
        scale: 1.55,
        x: '18%',
        y: '-16%',
        inventoryLocation: 'lower-door',
        sectionKey: 'lower',
        isDoor: true,
        label: 'Lower door',
        imageLabel: 'Lower fridge door',
        hotspot: { left: '16%', top: '43%', width: '19%', height: '36%', markerLeft: '34%', markerTop: '38%' },
    },
    'lower-fridge': {
        scale: 1.56,
        x: '-11%',
        y: '-15%',
        inventoryLocation: 'lower-fridge',
        sectionKey: 'lower',
        isDoor: false,
        label: 'Lower section',
        imageLabel: 'Lower fridge section',
        hotspot: { left: '34%', top: '44%', width: '25%', height: '35%', markerLeft: '37%', markerTop: '37%' },
    },
    pantry: {
        scale: 1.55,
        x: '-33%',
        y: '-6%',
        inventoryLocation: 'pantry',
        storage: 'pantry',
        label: 'Pantry',
        imageLabel: 'Pantry shelf',
        hotspot: { left: '61%', top: '33%', width: '17%', height: '46%', markerLeft: '47%', markerTop: '38%' },
    },
};

const TWO_LAYERED_COMPARTMENT_VIEWS = ['upper-fridge', 'upper-door', 'lower-fridge', 'lower-door', 'pantry'];

function getModelById(modelId) {
    return FRIDGE_MODELS.find(model => model.id === modelId) || FRIDGE_MODELS[0];
}

function buildSectionDrafts(modelId) {
    return getModelById(modelId).sections.map(section => ({ ...section }));
}

function getStorageTypeLabel(typeId) {
    return STORAGE_TYPE_OPTIONS.find(option => option.id === typeId)?.label || typeId;
}

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
    const [selectedFridgeId, setSelectedFridgeId] = useState(() => getCurrentFridgeId());
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dashboardLoadFailed, setDashboardLoadFailed] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showFridgeManagement, setShowFridgeManagement] = useState(false);
    const [showCreateFridgeModal, setShowCreateFridgeModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [inventoryPanelMode, setInventoryPanelMode] = useState('visual');
    const [activeInventoryView, setActiveInventoryView] = useState(null);
    const [inventoryOverlayKind, setInventoryOverlayKind] = useState('visual');
    const [fridgeView, setFridgeView] = useState('all-open');
    const [fridgeTransitioning, setFridgeTransitioning] = useState(false);
    const [visualizerOpening, setVisualizerOpening] = useState(false);
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
    const [setupMode, setSetupMode] = useState('choice');
    const [setupStep, setSetupStep] = useState('model');
    const [fridgeName, setFridgeName] = useState('Home Fridge');
    const [fridgeModel, setFridgeModel] = useState('two_layered');
    const [sectionDrafts, setSectionDrafts] = useState(() => buildSectionDrafts('two_layered'));
    const [showStorageGuide, setShowStorageGuide] = useState(false);
    const [renderedInventoryItems, setRenderedInventoryItems] = useState([]);
    const [inventoryListPhase, setInventoryListPhase] = useState('entered');
    const inventoryListFirstRender = useRef(true);
    const inventoryListEnterTimer = useRef(null);
    const visualizerOpeningTimer = useRef(null);
    const inventorySearchInputRef = useRef(null);
    const notificationSnoozeKey = useMemo(() => getNotificationSnoozeKey(user?.id), [user?.id]);
    const [dismissedNotificationKey, setDismissedNotificationKey] = useState(() => {
        const initialKey = getNotificationSnoozeKey(user?.id);
        return isNotificationSnoozed(initialKey) ? initialKey : '';
    });

    const hasFridge = fridges.length > 0;
    const selectedFridgeModel = useMemo(() => getModelById(fridgeModel), [fridgeModel]);
    const activeFridge = fridges.find(fridge => String(fridge.id) === String(selectedFridgeId)) ?? fridges[0] ?? null;
    const currentFridgeItems = useMemo(
        () => activeFridge
            ? itemList.filter(item => !item.fridge_id || Number(item.fridge_id) === Number(activeFridge.id))
            : [],
        [activeFridge, itemList]
    );
    const expiringItems = useMemo(
        () => currentFridgeItems.filter(item => EXPIRY_STATUSES.has(item.expiry_status)),
        [currentFridgeItems]
    );
    const unreadNotifications = useMemo(
        () => notifications.filter(notification => !notification.read_at),
        [notifications]
    );
    const notificationPopupDismissed =
        dismissedNotificationKey === notificationSnoozeKey || isNotificationSnoozed(notificationSnoozeKey);
    const showNotificationPopup = unreadNotifications.length > 0 && !notificationPopupDismissed;

    const activeFridgeVisualizerImage = FRIDGE_VISUALIZER_IMAGES[activeFridge?.model_type] ?? twoLayeredVisualizerImage;
    const activeSection = STORAGE_SECTIONS.find(section => section.id === activeInventoryView);
    const hasCompartmentPreview = activeFridge?.model_type === 'two_layered';
    const activeFridgeStateImages = useMemo(
        () => FRIDGE_STATE_IMAGES[activeFridge?.model_type] ?? {},
        [activeFridge?.model_type]
    );
    const allOpenFridgeImage = activeFridgeStateImages['all-open'] ?? activeFridgeVisualizerImage;
    const activeFridgeViewConfig = FRIDGE_VIEW_CONFIG[fridgeView] ?? FRIDGE_VIEW_CONFIG['all-open'];
    const activeFridgeViewImage =
        activeFridgeStateImages[fridgeView] ?? allOpenFridgeImage;
    const fridgeHotspotConfigs = hasCompartmentPreview
        ? TWO_LAYERED_COMPARTMENT_VIEWS.map(view => ({ id: view, ...FRIDGE_VIEW_CONFIG[view] }))
        : [];

    const visibleInventoryItems = useMemo(() => {
        if (activeInventoryView === 'item' && focusedInventoryItemId) {
            return currentFridgeItems.filter(item => item.id === focusedInventoryItemId);
        }
        if (activeFridgeViewConfig.inventoryLocation) {
            if (activeFridgeViewConfig.storage) {
                return currentFridgeItems.filter(item => item.storage === activeFridgeViewConfig.storage);
            }
            const focusedSection = activeFridge?.sections?.find(
                section => section.section_key === activeFridgeViewConfig.sectionKey
            );
            return currentFridgeItems.filter(item => {
                const itemSectionId = Number(item.storage_section_id);
                const focusedSectionId = Number(focusedSection?.id);
                if (focusedSectionId) {
                    return itemSectionId === focusedSectionId && Boolean(item.is_in_door) === activeFridgeViewConfig.isDoor;
                }
                return Boolean(item.is_in_door) === activeFridgeViewConfig.isDoor;
            });
        }
        if (!activeInventoryView || activeInventoryView === 'all') return currentFridgeItems;
        return currentFridgeItems.filter(item => activeSection?.storageValues.includes(item.storage));
    }, [activeFridge?.sections, activeFridgeViewConfig, activeInventoryView, activeSection, currentFridgeItems, focusedInventoryItemId]);

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
    const searchedItemIds = useMemo(
        () => searchedItems.map(item => item.id).join(','),
        [searchedItems]
    );

    const activeFilterCount = expiryFilter.size + storageFilter.size;

    const toggleInSet = (setter, value) => {
        setter(current => {
            const next = new Set(current);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    const switchFridge = (fridge) => {
        const nextId = String(fridge.id);
        setSelectedFridgeId(nextId);
        setCurrentFridgeId(nextId);
        setShowFridgeManagement(false);
        closeInventory();
        showTemporaryMessage(`Switched to ${fridge.name}.`);
    };

    const startCreateFridge = () => {
        setShowFridgeManagement(false);
        setShowCreateFridgeModal(true);
        setSetupMode('initialize');
        setSetupStep('model');
        setFridgeModel('two_layered');
        setFridgeName('Home Fridge');
        setSectionDrafts(buildSectionDrafts('two_layered'));
        setShowStorageGuide(false);
    };

    const openVisualInventory = () => {
        if (visualizerOpeningTimer.current) window.clearTimeout(visualizerOpeningTimer.current);
        setVisualizerOpening(true);
        setInventoryOverlayKind('visual');
        setActiveInventoryView('all');
        setFridgeView('all-open');
        visualizerOpeningTimer.current = window.setTimeout(() => setVisualizerOpening(false), 720);
    };

    const openSectionInventory = (view, { filters = false } = {}) => {
        setVisualizerOpening(false);
        setInventoryOverlayKind('list');
        setFridgeView('all-open');
        setShowFilters(filters);
        setActiveInventoryView(view);
    };

    const openSearchInventory = () => {
        openSectionInventory('all');
        window.setTimeout(() => inventorySearchInputRef.current?.focus(), 0);
    };

    const closeInventory = () => {
        setVisualizerOpening(false);
        if (visualizerOpeningTimer.current) window.clearTimeout(visualizerOpeningTimer.current);
        setActiveInventoryView(null);
        setInventoryOverlayKind('visual');
        setFridgeView('all-open');
        setSearchText('');
        setShowFilters(false);
        setExpiryFilter(new Set());
        setStorageFilter(new Set());
    };

    const transitionFridgeView = useCallback((nextView) => {
        if (fridgeTransitioning || fridgeView === nextView) return;
        setFridgeTransitioning(true);
        setFridgeView(nextView);
        window.setTimeout(() => setFridgeTransitioning(false), nextView === 'all-open' ? 560 : 650);
    }, [fridgeTransitioning, fridgeView]);

    const focusFridgeCompartment = useCallback((nextView) => {
        if (!hasCompartmentPreview || !FRIDGE_VIEW_CONFIG[nextView]) return;
        transitionFridgeView(nextView);
    }, [hasCompartmentPreview, transitionFridgeView]);

    const returnToFullFridgeView = useCallback(() => {
        if (fridgeView !== 'all-open') transitionFridgeView('all-open');
    }, [fridgeView, transitionFridgeView]);

    const focusedInventoryItem = currentFridgeItems.find(item => item.id === focusedInventoryItemId);

    const inventoryTitle = activeInventoryView === 'item'
        ? focusedInventoryItem?.name ?? 'Item details'
        : activeFridgeViewConfig.inventoryLocation
        ? activeFridgeViewConfig.label
        : activeInventoryView === 'all'
        ? 'Full inventory'
        : activeSection?.label ?? 'Inventory';

    const countItemsInSection = (section) => currentFridgeItems.filter(item => section.storageValues.includes(item.storage)).length;

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
        setDashboardLoadFailed(false);
        try {
            const householdId = await ensureCurrentHousehold();
            if (!householdId) {
                setFridges([]);
                setSelectedFridgeId('');
                setCurrentFridgeId('');
                setItemList([]);
                setNotifications([]);
                return;
            }

            const fridgeRes = await getFridges();
            const nextFridges = fridgeRes.data ?? [];
            setFridges(nextFridges);

            if (nextFridges.length === 0) {
                setSelectedFridgeId('');
                setCurrentFridgeId('');
                setItemList([]);
                setNotifications([]);
                return;
            }

            const storedFridgeId = getCurrentFridgeId();
            const selectedStillExists = nextFridges.some(fridge => String(fridge.id) === String(storedFridgeId));
            const nextSelectedFridgeId = selectedStillExists ? storedFridgeId : String(nextFridges[0].id);
            setSelectedFridgeId(nextSelectedFridgeId);
            setCurrentFridgeId(nextSelectedFridgeId);

            const [itemRes, notificationRes] = await Promise.all([
                getItemList({ sort: 'expiry_asc' }),
                getNotifications(),
            ]);
            setItemList(itemRes.data);
            setNotifications(notificationRes.data);
        } catch {
            setDashboardLoadFailed(true);
            setFridges([]);
            setItemList([]);
            setNotifications([]);
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
                setDashboardLoadFailed(false);
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
                if (!ignore) {
                    setDashboardLoadFailed(true);
                    setFridges([]);
                    setItemList([]);
                    setNotifications([]);
                    setError('Failed to load dashboard. Check that the server is running, then try again.');
                }
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        [allOpenFridgeImage, activeFridgeViewImage, ...Object.values(activeFridgeStateImages)].forEach(src => {
            if (!src) return;
            const image = new Image();
            image.src = src;
            image.decode?.().catch(() => {});
        });
    }, [activeFridgeStateImages, activeFridgeViewImage, allOpenFridgeImage]);

    useEffect(() => {
        if (!activeInventoryView || fridgeView === 'all-open') return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') returnToFullFridgeView();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeInventoryView, fridgeView, returnToFullFridgeView]);

    useEffect(() => {
        if (inventoryListFirstRender.current) {
            inventoryListFirstRender.current = false;
            setRenderedInventoryItems(searchedItems);
            return undefined;
        }

        setInventoryListPhase('leaving');
        const leaveTimer = window.setTimeout(() => {
            setRenderedInventoryItems(searchedItems);
            setInventoryListPhase('entering');
            const enterTimer = window.setTimeout(() => {
                setInventoryListPhase('entered');
            }, 260);
            inventoryListEnterTimer.current = enterTimer;
        }, fridgeView === 'all-open' ? 120 : 170);

        return () => {
            window.clearTimeout(leaveTimer);
            if (inventoryListEnterTimer.current) {
                window.clearTimeout(inventoryListEnterTimer.current);
            }
        };
    }, [searchedItemIds, searchedItems, fridgeView]);

    useEffect(() => () => {
        if (visualizerOpeningTimer.current) window.clearTimeout(visualizerOpeningTimer.current);
    }, []);

    const showTemporaryMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    const openAddForm = () => {
        if (!hasFridge) {
            setSetupMode('initialize');
            setSetupStep('model');
            return;
        }
        setEditingItem(null);
        setShowForm(true);
    };

    const startInitializeFridge = () => {
        setSetupMode('initialize');
        setSetupStep('model');
        setShowStorageGuide(false);
    };

    const startJoinHousehold = () => {
        setSetupMode('join');
        setShowStorageGuide(false);
    };

    const returnToSetupChoice = () => {
        setSetupMode('choice');
        setSetupStep('model');
        setShowStorageGuide(false);
    };

    const selectFridgeModel = (model) => {
        setFridgeModel(model.id);
        setSectionDrafts(model.sections.map(section => ({ ...section })));
        setSetupStep('sections');
        setShowStorageGuide(false);
    };

    const updateSectionDraft = (sectionKey, updates) => {
        setSectionDrafts(current => current.map(section => (
            section.section_key === sectionKey ? { ...section, ...updates } : section
        )));
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
            const res = await initializeFridge({
                name: fridgeName.trim(),
                model_type: fridgeModel,
                sections: sectionDrafts.map(section => ({
                    section_key: section.section_key,
                    name: section.name,
                    section_type: section.section_type,
                    has_door_space: section.has_door_space,
                })),
            });
            const createdFridgeId = res.data?.fridge?.id;
            if (createdFridgeId) {
                setSelectedFridgeId(String(createdFridgeId));
                setCurrentFridgeId(createdFridgeId);
            }
            setShowCreateFridgeModal(false);
            setSetupMode('choice');
            setSetupStep('model');
            setShowStorageGuide(false);
            showTemporaryMessage(hasFridge ? 'New fridge created.' : 'Fridge initialized. Your household is ready.');
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
            setSetupMode('choice');
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
                <div><p className="eyebrow">Dashboard</p><h1>{activeFridge?.name || 'Your fridge'}</h1></div>
                <div className="button-row">
                    <button className="button secondary" onClick={() => navigate('/dashboard/recipes')}>Recipe Library</button>
                    {hasFridge && <button className="button secondary" type="button" onClick={() => setShowFridgeManagement(true)}>Fridge Management</button>}
                    {hasFridge && <button className="button" onClick={openAddForm}>+ Add item</button>}
                </div>
            </header>

            {message && <p className="message success" role="status">{message}</p>}
            {error && !dashboardLoadFailed && <p className="message error" role="alert">{error}</p>}

            {loading ? (
                <p className="panel empty-state dashboard-empty-panel">Loading dashboard...</p>
            ) : dashboardLoadFailed ? (
                <section className="panel empty-state dashboard-empty-panel dashboard-retry-panel">
                    <h2>Could not load your dashboard</h2>
                    <p>ByteBite could not reach the household and fridge data yet. Try again once the server is ready.</p>
                    <button className="button" type="button" onClick={loadDashboardData}>Retry</button>
                </section>
            ) : !hasFridge ? (
                <section className="panel fridge-setup-wizard" aria-labelledby="fridge-setup-title">
                    <div className="wizard-intro">
                        <div>
                            <p className="eyebrow">Household setup</p>
                            <h2 id="fridge-setup-title">Set up a fridge first</h2>
                            <p>This household has no fridge yet, so inventory and expiry alerts are paused until there is somewhere to store food.</p>
                        </div>
                        {setupMode === 'initialize' && (
                            <ol className="setup-stepper" aria-label="Fridge setup steps">
                                {[
                                    ['model', 'Choose model'],
                                    ['sections', 'Customize sections'],
                                    ['name', 'Name fridge'],
                                ].map(([stepId, label], index) => (
                                    <li key={stepId} className={setupStep === stepId ? 'is-active' : ''}>
                                        <span>{index + 1}</span>
                                        {label}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {setupMode === 'choice' && (
                        <div className="setup-choice-grid">
                            <button className="setup-choice-card" type="button" onClick={startInitializeFridge}>
                                <StorageComboIcon className="storage-combo-icon-tile" />
                                <span>
                                    <strong>Initialize new fridge</strong>
                                    <small>Create a fridge for this household, choose its model, and customize the sections.</small>
                                </span>
                            </button>
                            <button className="setup-choice-card" type="button" onClick={startJoinHousehold}>
                                <span className="setup-code-icon">AB</span>
                                <span>
                                    <strong>Join existing household</strong>
                                    <small>Enter a household code if someone already has a shared fridge set up.</small>
                                </span>
                            </button>
                        </div>
                    )}

                    {setupMode === 'initialize' && setupStep === 'model' && (
                        <div className="setup-step-content">
                            <div className="setup-copy-row">
                                <div>
                                    <h3>Choose the closest match</h3>
                                    <p>Pick the shape that looks most like the fridge in this household. You can fine-tune the sections next.</p>
                                </div>
                                <button className="button secondary" type="button" onClick={returnToSetupChoice}>Back</button>
                            </div>
                            <div className="fridge-model-grid" role="list">
                                {FRIDGE_MODELS.map(model => (
                                    <button
                                        key={model.id}
                                        className="fridge-model-card"
                                        type="button"
                                        onClick={() => selectFridgeModel(model)}
                                    >
                                        <span className="fridge-model-art">
                                            <img src={model.image} alt="" />
                                        </span>
                                        <strong>{model.label}</strong>
                                        <small>{model.detail}</small>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {setupMode === 'initialize' && setupStep === 'sections' && (
                        <div className="setup-step-content setup-sections-grid">
                            <div className="selected-fridge-preview" aria-hidden="true">
                                <img src={selectedFridgeModel.image} alt="" />
                                <span>{selectedFridgeModel.label}</span>
                            </div>
                            <div className="section-customizer">
                                <div className="setup-copy-row">
                                    <div>
                                        <h3>Customize storage sections</h3>
                                        <p>Use the real purpose of each section, then choose whether it has door storage.</p>
                                    </div>
                                    <button className="guide-button" type="button" onClick={() => setShowStorageGuide(current => !current)} aria-expanded={showStorageGuide}>
                                        ? <span>Storage type guide</span>
                                    </button>
                                </div>

                                {showStorageGuide && (
                                    <div className="storage-guide" role="note">
                                        {STORAGE_TYPE_OPTIONS.map(option => (
                                            <article key={option.id}>
                                                <strong>{option.label}</strong>
                                                <span>{option.temperature}</span>
                                                <small>{option.examples}</small>
                                            </article>
                                        ))}
                                    </div>
                                )}

                                <div className="section-draft-list">
                                    {sectionDrafts.map(section => (
                                        <article className="section-draft-card" key={section.section_key}>
                                            <div>
                                                <strong>{section.name}</strong>
                                                <small>{getStorageTypeLabel(section.section_type)}</small>
                                            </div>
                                            <label>
                                                Storage type
                                                <select
                                                    value={section.section_type}
                                                    onChange={event => updateSectionDraft(section.section_key, { section_type: event.target.value })}
                                                >
                                                    {STORAGE_TYPE_OPTIONS.map(option => (
                                                        <option key={option.id} value={option.id}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="door-storage-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={section.has_door_space}
                                                    onChange={event => updateSectionDraft(section.section_key, { has_door_space: event.target.checked })}
                                                />
                                                <span>Has door storage</span>
                                            </label>
                                        </article>
                                    ))}
                                </div>

                                <div className="button-row">
                                    <button className="button secondary" type="button" onClick={() => setSetupStep('model')}>Back</button>
                                    <button className="button" type="button" onClick={() => setSetupStep('name')}>Continue</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {setupMode === 'initialize' && setupStep === 'name' && (
                        <form className="setup-step-content setup-name-step" onSubmit={handleInitializeFridge}>
                            <div className="selected-fridge-preview is-compact" aria-hidden="true">
                                <img src={selectedFridgeModel.image} alt="" />
                            </div>
                            <div className="section-customizer">
                                <h3>Name this fridge</h3>
                                <p>This name will appear when the household has more than one fridge later.</p>
                                <label>
                                    Fridge name
                                    <input value={fridgeName} onChange={event => setFridgeName(event.target.value)} required autoFocus />
                                </label>
                                <div className="setup-summary">
                                    {sectionDrafts.map(section => (
                                        <span key={section.section_key}>{section.name}: {getStorageTypeLabel(section.section_type)}</span>
                                    ))}
                                </div>
                                <div className="button-row">
                                    <button className="button secondary" type="button" onClick={() => setSetupStep('sections')}>Back</button>
                                    <button className="button" type="submit" disabled={setupBusy || !fridgeName.trim()}>
                                        {setupBusy ? 'Initializing...' : 'Initialize fridge'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {setupMode === 'join' && (
                        <div className="setup-step-content setup-join-step">
                            <div className="setup-copy-row">
                                <div>
                                    <h3>Join a household</h3>
                                    <p>Use the code from another household member. If that household has fridges, they will show on your dashboard after joining.</p>
                                </div>
                                <button className="button secondary" type="button" onClick={returnToSetupChoice}>Back</button>
                            </div>
                            <form className="fridge-setup-join" onSubmit={handleJoinHousehold}>
                                <label htmlFor="dashboard-join-code">Household code</label>
                                <div className="household-inline-control">
                                    <input
                                        id="dashboard-join-code"
                                        value={joinCode}
                                        onChange={event => setJoinCode(event.target.value.toUpperCase())}
                                        placeholder="AB12CD34EF"
                                        autoFocus
                                    />
                                    <button className="button secondary" type="submit" disabled={setupBusy || !joinCode.trim()}>Join</button>
                                </div>
                            </form>
                        </div>
                    )}
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
                            <span>{currentFridgeItems.length} item(s)</span>
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
                            <button type="button" className="visualizer-filter-button" aria-label="Search inventory" onClick={openSearchInventory}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="7" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </button>
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
                        <>
                            <div className="fridge-visual is-icon-mode">
                                <button type="button" className="fridge-section visual-inventory-entry" aria-label="Open full fridge and pantry inventory" onClick={openVisualInventory}>
                                    <img className="fridge-visualizer-image" src={activeFridgeVisualizerImage} alt={`${activeFridge?.name ?? 'Fridge'} with pantry`} />
                                </button>
                            </div>
                            <p className="storage-legend"><span aria-hidden="true" />Orange shelf represents pantry storage.</p>
                        </>
                    ) : (
                        <>
                            <div className="fridge-visual">
                                <button type="button" className="fridge-section full-inventory" onClick={() => openSectionInventory('all')}>
                                    <StorageComboIcon className="storage-combo-icon-tile" />
                                    <span>View full inventory</span>
                                    <small>{currentFridgeItems.length} total</small>
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
                            <p className="storage-legend"><span aria-hidden="true" />Orange shelf represents pantry storage.</p>
                        </>
                    )}
                </section>

                <NotificationInbox
                    expiringItems={expiringItems}
                    onViewSuggestions={() => {
                        const ids = [...new Set(
                            currentFridgeItems
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

            {showFridgeManagement && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowFridgeManagement(false)}>
                    <section className="modal panel fridge-management-modal" role="dialog" aria-modal="true" aria-labelledby="fridge-management-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Household fridges</p>
                                <h2 id="fridge-management-title">Fridge management</h2>
                            </div>
                            <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowFridgeManagement(false)}>x</button>
                        </div>

                        <div className="fridge-management-list">
                            {fridges.map(fridge => {
                                const isCurrent = String(fridge.id) === String(activeFridge?.id);
                                const model = getModelById(fridge.model_type);
                                const fridgeItems = itemList.filter(item => !item.fridge_id || Number(item.fridge_id) === Number(fridge.id));
                                return (
                                    <article className={`fridge-management-card${isCurrent ? ' is-current' : ''}`} key={fridge.id}>
                                        <img src={model.image} alt="" />
                                        <div>
                                            <strong>{fridge.name}</strong>
                                            <small>{model.label} · {fridgeItems.length} item(s)</small>
                                            {isCurrent && <span>Current fridge</span>}
                                        </div>
                                        <button
                                            className="button secondary"
                                            type="button"
                                            disabled={isCurrent}
                                            onClick={() => switchFridge(fridge)}
                                        >
                                            {isCurrent ? 'Selected' : 'Switch to this fridge'}
                                        </button>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="fridge-management-actions">
                            <button className="button" type="button" onClick={startCreateFridge}>Create new fridge</button>
                            <button className="button secondary" type="button" onClick={() => navigate('/dashboard/profile')}>Household management</button>
                        </div>
                    </section>
                </div>
            )}

            {showCreateFridgeModal && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreateFridgeModal(false)}>
                    <section className="modal panel create-fridge-modal" role="dialog" aria-modal="true" aria-labelledby="create-fridge-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">New household fridge</p>
                                <h2 id="create-fridge-title">Create new fridge</h2>
                            </div>
                            <button className="icon-button" type="button" aria-label="Close" onClick={() => setShowCreateFridgeModal(false)}>x</button>
                        </div>

                        <ol className="setup-stepper create-fridge-stepper" aria-label="Fridge setup progress">
                            {[
                                ['model', 'Choose model'],
                                ['sections', 'Customize sections'],
                                ['name', 'Name fridge'],
                            ].map(([stepId, label], index) => (
                                <li key={stepId} className={setupStep === stepId ? 'is-active' : ''}>
                                    <span>{index + 1}</span>{label}
                                </li>
                            ))}
                        </ol>

                        {setupStep === 'model' && (
                            <div className="setup-step-content">
                                <div className="setup-copy-row">
                                    <div>
                                        <h3>Choose the closest match</h3>
                                        <p>Pick the shape that looks most like this new fridge.</p>
                                    </div>
                                </div>
                                <div className="fridge-model-grid">
                                    {FRIDGE_MODELS.map(model => (
                                        <button
                                            className="fridge-model-card"
                                            type="button"
                                            key={model.id}
                                            onClick={() => {
                                                setFridgeModel(model.id);
                                                setSectionDrafts(buildSectionDrafts(model.id));
                                                setSetupStep('sections');
                                            }}
                                        >
                                            <span className="fridge-model-art"><img src={model.image} alt="" /></span>
                                            <strong>{model.label}</strong>
                                            <small>{model.detail}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {setupStep === 'sections' && (
                            <div className="setup-step-content setup-sections-grid">
                                <div className="selected-fridge-preview" aria-hidden="true">
                                    <img src={selectedFridgeModel.image} alt="" />
                                </div>
                                <div className="section-customizer">
                                    <div className="setup-copy-row">
                                        <div>
                                            <h3>Customize sections</h3>
                                            <p>Match each compartment to how this fridge is used.</p>
                                        </div>
                                        <button className="guide-button" type="button" onClick={() => setShowStorageGuide(v => !v)}>
                                            ? <span>Storage guide</span>
                                        </button>
                                    </div>

                                    {showStorageGuide && (
                                        <div className="storage-guide" role="note">
                                            {STORAGE_TYPE_OPTIONS.map(option => (
                                                <article key={option.id}>
                                                    <strong>{option.label}</strong>
                                                    <span>{option.temperature}</span>
                                                    <small>{option.examples}</small>
                                                </article>
                                            ))}
                                        </div>
                                    )}

                                    <div className="section-draft-list">
                                        {sectionDrafts.map(section => (
                                            <article className="section-draft-card" key={section.section_key}>
                                                <div>
                                                    <strong>{section.name}</strong>
                                                    <small>{getStorageTypeLabel(section.section_type)}</small>
                                                </div>
                                                <label>
                                                    Storage type
                                                    <select
                                                        value={section.section_type}
                                                        onChange={event => updateSectionDraft(section.section_key, { section_type: event.target.value })}
                                                    >
                                                        {STORAGE_TYPE_OPTIONS.map(option => (
                                                            <option key={option.id} value={option.id}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="door-storage-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={section.has_door_space}
                                                        onChange={event => updateSectionDraft(section.section_key, { has_door_space: event.target.checked })}
                                                    />
                                                    <span>Has door storage</span>
                                                </label>
                                            </article>
                                        ))}
                                    </div>

                                    <div className="button-row">
                                        <button className="button secondary" type="button" onClick={() => setSetupStep('model')}>Back</button>
                                        <button className="button" type="button" onClick={() => setSetupStep('name')}>Continue</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {setupStep === 'name' && (
                            <form className="setup-step-content setup-name-step" onSubmit={handleInitializeFridge}>
                                <div className="selected-fridge-preview is-compact" aria-hidden="true">
                                    <img src={selectedFridgeModel.image} alt="" />
                                </div>
                                <div className="section-customizer">
                                    <h3>Name this fridge</h3>
                                    <p>This name will help household members choose the right fridge later.</p>
                                    <label>
                                        Fridge name
                                        <input value={fridgeName} onChange={event => setFridgeName(event.target.value)} required autoFocus />
                                    </label>
                                    <div className="setup-summary">
                                        {sectionDrafts.map(section => (
                                            <span key={section.section_key}>{section.name}: {getStorageTypeLabel(section.section_type)}</span>
                                        ))}
                                    </div>
                                    <div className="button-row">
                                        <button className="button secondary" type="button" onClick={() => setSetupStep('sections')}>Back</button>
                                        <button className="button" type="submit" disabled={setupBusy || !fridgeName.trim()}>
                                            {setupBusy ? 'Creating...' : 'Create fridge'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </section>
                </div>
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
                    <section className={`inventory-stage inventory-modal ${inventoryOverlayKind === 'visual' ? 'has-visualizer' : 'is-list-only'}${visualizerOpening ? ' is-shared-opening' : ''}`} role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title" onMouseDown={event => event.stopPropagation()}>
                        {inventoryOverlayKind === 'visual' && (
                            <div className="inventory-stage-visual">
                                <div
                                    className={`fridge-focus-stage ${fridgeView === 'all-open' ? 'is-overview' : 'is-focused'}`}
                                    style={{
                                        '--fridge-view-scale': activeFridgeViewConfig.scale,
                                        '--fridge-view-x': activeFridgeViewConfig.x,
                                        '--fridge-view-y': activeFridgeViewConfig.y,
                                    }}
                                >
                                    <button
                                        className="fridge-focus-return"
                                        type="button"
                                        aria-label={fridgeView === 'all-open' ? activeFridgeViewConfig.imageLabel : 'Return to full fridge view'}
                                        onClick={fridgeView === 'all-open' ? undefined : returnToFullFridgeView}
                                        disabled={fridgeTransitioning || fridgeView === 'all-open'}
                                    />
                                    <div className="fridge-focus-camera">
                                        <img
                                            className={`fridge-focus-image ${fridgeView === 'all-open' ? 'is-visible' : 'is-muted'}`}
                                            src={allOpenFridgeImage}
                                            alt=""
                                            draggable="false"
                                        />
                                        <img
                                            className={`fridge-focus-image ${fridgeView === 'all-open' ? 'is-muted' : 'is-visible'}`}
                                            src={activeFridgeViewImage}
                                            alt=""
                                            draggable="false"
                                        />
                                        {fridgeView === 'all-open' && fridgeHotspotConfigs.map(config => (
                                            <button
                                                className={`fridge-hotspot ${config.id}-hotspot`}
                                                type="button"
                                                key={config.id}
                                                aria-label={`Focus on ${config.label.toLowerCase()}`}
                                                disabled={fridgeTransitioning}
                                                onClick={() => focusFridgeCompartment(config.id)}
                                                style={{
                                                    left: config.hotspot.left,
                                                    top: config.hotspot.top,
                                                    width: config.hotspot.width,
                                                    height: config.hotspot.height,
                                                    '--hotspot-marker-left': config.hotspot.markerLeft ?? '50%',
                                                    '--hotspot-marker-top': config.hotspot.markerTop ?? '50%',
                                                }}
                                            >
                                                <span>{config.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
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
                                    ref={inventorySearchInputRef}
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
                        ) : (
                            <div className={`inventory-results inventory-results-${inventoryListPhase}`}>
                            {renderedInventoryItems.length === 0 ? (
                            <p className="panel empty-state">
                                {searchText ? `No items match “${searchText}”.` : 'No items match these filters.'}
                            </p>
                        ) : (
                            <ItemList
                                itemList={renderedInventoryItems}
                                onEditItem={openEditForm}
                                onItemDeleted={() => refreshAfterItemChange('Item successfully deleted.')}
                                onItemUpdated={() => refreshAfterItemChange('Item successfully updated.')}
                            />
                            )}
                            </div>
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
