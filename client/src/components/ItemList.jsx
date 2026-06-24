import ItemCard from './ItemCard';

// Codex minimal UI pass: explicit empty state for a new user's inventory.
export default function ItemList({ itemList, onItemDeleted }) {
    if (!itemList.length) return <p className="panel empty-state">Your inventory is empty. Add your first item above.</p>;
    return <div className="item-list">{itemList.map(item => <ItemCard key={item.id} item={item} onItemDeleted={onItemDeleted} />)}</div>;
}
