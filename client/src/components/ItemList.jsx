import ItemCard from "./ItemCard";

export default function ItemList({ itemList, onItemDeleted}) {
    return itemList.map(item => <ItemCard key={item.id} item={item} onItemDeleted={onItemDeleted} />); 
}