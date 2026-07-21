import { client } from './client'
import { getAuthHeader } from '../context/AuthenticationContext';

export const getNotifications = () => {
    const headers = getAuthHeader();
    return client.get('/api/v1/notifications', { headers });
};

export const updateNotification = (id, data) => {
    const headers = getAuthHeader();
    return client.patch(`/api/v1/notifications/${id}`, data, { headers });
};
