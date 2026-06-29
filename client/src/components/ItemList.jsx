import { useState, useRef } from 'react';
import ItemCard from './ItemCard';

export default function ItemList({ itemList, onItemDeleted, onItemUpdated, onEditItem }) {
    const [modalContainer, setModalContainer] = useState(null);
    
    if (!itemList.length) return <p className="panel empty-state">Your inventory is empty. Add your first item above.</p>;

    return <div ref={setModalContainer} className="item-list">{itemList.map(item => (
        <ItemCard
            key={item.id}
            item={item}
            modalContainer={modalContainer}
            onItemDeleted={onItemDeleted}
            onItemUpdated={onItemUpdated}
            onEditItem={onEditItem}
        />
    ))}</div>;
}
