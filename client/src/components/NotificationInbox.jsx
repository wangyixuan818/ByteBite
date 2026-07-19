export default function NotificationInbox({ expiringItems, onViewSuggestions }) {
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
                    <span>Sorted soonest</span>
                </div>

                {expiringItems.length === 0 ? (
                    <p className="alert-empty">Nothing urgent right now.</p>
                ) : (
                    <ul className="expiry-alert-list">
                        {expiringItems.map(item => (
                            <li key={item.id} className={item.days_until_expiry <= 0 ? 'urgent' : ''}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <small>{item.storage || 'Storage not set'}</small>
                                </div>
                                <span>{expiryLabel(item)}</span>
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
