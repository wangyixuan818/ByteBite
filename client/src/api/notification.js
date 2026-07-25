import { client } from './client'
import { getAuthHeader } from '../context/AuthenticationContext';
import { withCurrentHouseholdParams } from '../utils/currentHousehold';

export const getNotifications = () => {
    const headers = getAuthHeader();
    return client.get('/api/v1/notifications', { headers, params: withCurrentHouseholdParams() });
};

export const updateNotification = (id, data) => {
    const headers = getAuthHeader();
    return client.patch(`/api/v1/notifications/${id}`, data, { headers, params: withCurrentHouseholdParams() });
};
