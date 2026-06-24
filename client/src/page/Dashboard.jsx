import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';
import { getItemList } from '../api/item';
import { AddItemForm } from '../components/AddItemForm';
import ItemList from '../components/ItemList';

// Codex minimal UI pass: dashboard shell and interactions based on the approved user flow.
export default function Dashboard() {
    const { user, logout } = useAuthentication();
    const navigate = useNavigate();
    const [itemList, setItemList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState('');

    const expiringItems = useMemo(
        () => itemList.filter(item => ['expired', 'expiring_today', 'expiring_soon', 'expiring_this_week'].includes(item.expiry_status)),
        [itemList]
    );

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

    useEffect(() => {
        // Codex minimal UI pass: keep initial effect updates inside async callbacks for React 19 linting.
        getItemList({ sort: 'expiry_asc' })
            .then(res => setItemList(res.data))
            .catch(() => setError('Failed to get items. Check that the server is running, then try again.'))
            .finally(() => setLoading(false));
    }, []);

    const showTemporaryMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    return (
        <main className="page-shell dashboard-page">
            <nav className="topbar">
                <strong>ByteBite</strong>
                <div className="button-row">
                    <span>{user?.display_name}</span>
                    <button className="button secondary" onClick={logout}>Log out</button>
                </div>
            </nav>

            <header className="dashboard-header">
                <div><p className="eyebrow">Dashboard</p><h1>Your fridge</h1></div>
                <div className="button-row">
                    <button className="button secondary" onClick={() => navigate('/dashboard/recipes')}>Food suggestions</button>
                    <button className="button" onClick={() => setShowForm(true)}>+ Add item</button>
                </div>
            </header>

            {message && <p className="message success" role="status">{message}</p>}
            {error && <p className="message error" role="alert">{error}</p>}

            <section className="dashboard-grid">
                <button className="fridge-visual panel" onClick={() => document.getElementById('inventory')?.scrollIntoView({ behavior: 'smooth' })}>
                    <span className="fridge-title">Open inventory</span>
                    <span className="fridge-door">Fridge · {itemList.filter(i => i.storage !== 'freezer').length} items</span>
                    <span className="fridge-door freezer">Freezer · {itemList.filter(i => i.storage === 'freezer').length} items</span>
                </button>
                <aside className="panel alert-panel">
                    <h2>Expiring alert</h2>
                    {expiringItems.length === 0 ? <p>Nothing urgent right now.</p> : (
                        <ul>{expiringItems.slice(0, 4).map(item => <li key={item.id}><strong>{item.name}</strong> — {item.days_until_expiry < 0 ? 'expired' : `${item.days_until_expiry} day(s)`}</li>)}</ul>
                    )}
                    <button className="text-button" onClick={() => navigate('/dashboard/recipes')}>Check usage suggestions →</button>
                </aside>
            </section>

            <section id="inventory" className="inventory-section">
                <div className="section-heading"><div><p className="eyebrow">Sorted by expiry date</p><h2>Inventory</h2></div><span>{itemList.length} item(s)</span></div>
                {loading ? <p className="panel empty-state">Items loading…</p> : (
                    <ItemList itemList={itemList} onItemDeleted={() => { fetchItems(); showTemporaryMessage('Item successfully deleted.'); }} />
                )}
            </section>

            {showForm && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}>
                    <section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="add-item-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading"><h2 id="add-item-title">Add food</h2><button className="icon-button" aria-label="Close" onClick={() => setShowForm(false)}>×</button></div>
                        <AddItemForm onItemAdded={() => { fetchItems(); setShowForm(false); showTemporaryMessage('Item successfully added.'); }} />
                    </section>
                </div>
            )}
        </main>
    );
}
