import { Check, Utensils } from 'lucide-react';

export default function NotificationInbox({
    expiringItems,
    onViewSuggestions,
    onConsumeAll,
    onConsumeItem,
    onUseItem,
    onViewItem,
}) {
    const expiryLabel = (item) => {
        if (item.days_until_expiry < 0) return 'Expired';
        if (item.days_until_expiry === 0) return 'Expires today';
        if (item.days_until_expiry === 1) return 'Expires tomorrow';
        return `Expires in ${item.days_until_expiry} days`;
    };

    return (
        <aside className="panel alert-panel">
            <div className="section-heading compact">
                <div>
                    <p className="eyebrow">Alerts</p>
                    <h2>Expiring food</h2>
                </div>
                <span className="alert-count">{expiringItems.length || 'None'}</span>
            </div>

            <section className="alert-section expiry-section" aria-labelledby="expiry-alert-title">
                <div className="alert-section-heading">
                    <h3 id="expiry-alert-title">Needs attention</h3>
                    <div className="button-row">
                        {/* <span className="alert-sort-badge">Sorted soonest</span> */}
                        {expiringItems.length > 0 && (
                            <button className="small-action-button consume-alerts-button" type="button" onClick={onConsumeAll}>
                                <Check size={14} />
                                <span>Consume all</span>
                            </button>
                        )}
                    </div>
                </div>

                {expiringItems.length === 0 ? (
                    <p className="alert-empty">Nothing urgent right now.</p>
                ) : (
                    <ul className="expiry-alert-list">
                        {expiringItems.map(item => (
                            <li key={item.id} className={item.days_until_expiry <= 0 ? 'urgent' : ''}>
                                <button className="expiry-alert-main" type="button" onClick={() => onViewItem(item)}>
                                    <strong>{item.name}</strong>
                                    <small>{item.storage || 'Storage not set'}</small>
                                </button>
                                <span>{expiryLabel(item)}</span>
                                <div className="expiry-alert-actions">
                                    <button
                                        className="mini-icon-button"
                                        type="button"
                                        onClick={() => onConsumeItem(item)}
                                        aria-label={`Consume all ${item.name}`}
                                        title="Consume all"
                                    >
                                        <Check size={15} />
                                    </button>
                                    <button
                                        className="mini-icon-button"
                                        type="button"
                                        onClick={() => onUseItem(item)}
                                        aria-label={`Use part of ${item.name}`}
                                        title="Use"
                                    >
                                        <Utensils size={15} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="tooltip-wrap">
                <button className="usage-suggestion-button" type="button" onClick={onViewSuggestions}>
                    Check usage suggestions
                </button>
                <span className="tooltip-bubble" role="tooltip">
                    Uses items expiring soon. Already-expired items are excluded.
                </span>
            </div>
        </aside>
    );
}
