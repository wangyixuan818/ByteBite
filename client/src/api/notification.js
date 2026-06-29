import axios from 'axios';
import { getAuthHeader } from '../context/AuthenticationContext';

export const getNotifications = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/notifications', { headers });
};

export const updateNotification = (id, data) => {
    const headers = getAuthHeader();
    return axios.patch(`/api/v1/notifications/${id}`, data, { headers });
};
