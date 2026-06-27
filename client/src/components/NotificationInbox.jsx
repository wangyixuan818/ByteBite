import { updateNotification } from '../api/notification';

export default function NotificationInbox({ notifications, expiringItems, onNotificationChanged, onViewSuggestions }) {
    const unreadNotifications = notifications.filter(notification => !notification.read_at);

    const markRead = async (notification) => {
        await updateNotification(notification.id, { read: true });
        onNotificationChanged();
    };

    return (
        <aside className="panel alert-panel">
            <div className="section-heading compact">
                <div>
                    <p className="eyebrow">Alerts</p>
                    <h2>{unreadNotifications.length ? 'Notification inbox' : 'Expiring alert'}</h2>
                </div>
                {unreadNotifications.length > 0 && <span>{unreadNotifications.length} unread</span>}
            </div>

            {unreadNotifications.length > 0 ? (
                <ul className="notification-list">
                    {unreadNotifications.slice(0, 5).map(notification => (
                        <li key={notification.id} className="unread">
                            <p>{notification.message}</p>
                            <small>{notification.notification_date?.split('T')[0] ?? notification.created_at?.split('T')[0]}</small>
                            <button className="text-button" type="button" onClick={() => markRead(notification)}>
                                Mark read
                            </button>
                        </li>
                    ))}
                </ul>
            ) : expiringItems.length === 0 ? (
                <p>Nothing urgent right now.</p>
            ) : (
                <ul>
                    {expiringItems.slice(0, 4).map(item => (
                        <li key={item.id}>
                            <strong>{item.name}</strong> — {item.days_until_expiry < 0 ? 'expired' : `${item.days_until_expiry} day(s)`}
                        </li>
                    ))}
                </ul>
            )}

            <button className="text-button" type="button" onClick={onViewSuggestions}>
                Check usage suggestions →
            </button>
        </aside>
    );
}
