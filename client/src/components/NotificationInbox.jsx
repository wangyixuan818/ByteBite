import { updateNotification } from '../api/notification';


export default function NotificationInbox({ notifications, onNotificationChanged }) {
    const unreadCount = notifications.filter(notification => !notification.read_at).length;

    const markRead = async (notification) => {
        await updateNotification(notification.id, { read: !notification.read_at });
        onNotificationChanged();
    };

    return (
        <aside className="panel notification-panel">
            <div className="section-heading compact">
                <div>
                    <p className="eyebrow">Notification inbox</p>
                    <h2>Alerts</h2>
                </div>
                <span>{unreadCount} unread</span>
            </div>

            {!notifications.length ? <p>No notifications yet.</p> : (
                <ul className="notification-list">
                    {notifications.slice(0, 5).map(notification => (
                        <li key={notification.id} className={notification.read_at ? 'read' : 'unread'}>
                            <p>{notification.message}</p>
                            <small>{notification.notification_date?.split('T')[0] ?? notification.created_at?.split('T')[0]}</small>
                            <button className="text-button" type="button" onClick={() => markRead(notification)}>
                                {notification.read_at ? 'Mark unread' : 'Mark read'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
