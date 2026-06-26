import ItemCard from './ItemCard';

export default function ItemList({ itemList, onItemDeleted, onItemUpdated, onEditItem }) {
    if (!itemList.length) return <p className="panel empty-state">Your inventory is empty. Add your first item above.</p>;
    return <div className="item-list">{itemList.map(item => (
        <ItemCard
            key={item.id}
            item={item}
            onItemDeleted={onItemDeleted}
            onItemUpdated={onItemUpdated}
            onEditItem={onEditItem}
        />
    ))}</div>;
}
