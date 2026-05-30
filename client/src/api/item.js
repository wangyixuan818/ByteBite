import axios from "axios";
import { getAuthHeader } from "../context/AuthenticationContext";

export const getFoodTypes = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/food-types', { headers });
}

export const getItemList = (params = {}) => {
    const headers = getAuthHeader();

    return axios.get('/api/v1/items', { headers, params })
}

export const addItem = (data) => {
    const headers = getAuthHeader();

    return axios.post('/api/v1/items', data, { headers });
}

export const getItem = (id) => {
    const headers = getAuthHeader();

    return axios.get(`/api/v1/items/${id}`, { headers });
}

export const updateItem = (id, data) => {
    const headers = getAuthHeader();

    return axios.patch(`/api/v1/items/${id}`, data, { headers });
}

export const deleteItem = (id) => {
    const headers = getAuthHeader();

    return axios.delete(`/api/v1/items/${id}`, { headers });
}