import axios from 'axios';
import { getAuthHeader } from '../context/AuthenticationContext';

export const getFridges = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/fridges', { headers });
};

export const initializeFridge = (payload) => {
    const headers = getAuthHeader();
    return axios.post('/api/v1/fridges/initialize', payload, { headers });
};

export const updateFridge = (id, payload) => {
    const headers = getAuthHeader();
    return axios.patch(`/api/v1/fridges/${id}`, payload, { headers });
};

export const updateStorageSection = (id, payload) => {
    const headers = getAuthHeader();
    return axios.patch(`/api/v1/storage-sections/${id}`, payload, { headers });
};
