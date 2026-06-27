import axios from "axios";
import { getAuthHeader } from "../context/AuthenticationContext";

export const getFoodTypes = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/food-types', { headers });
}

export const getCategories = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/categories', { headers });
}

// TODO(backend): implement POST /categories, including optional multipart thumbnail handling.
export const createCategory = ({ name, default_storage = 'fridge' }) => {
    const headers = getAuthHeader();
    return axios.post('/api/v1/categories', { name, default_storage }, { headers });
}

// TODO(backend): implement POST /food-types and return { food_type }.
export const createFoodType = (data) => {
    const headers = getAuthHeader();
    return axios.post('/api/v1/food-types', data, { headers });
}

export const getBrands = () => {
    const headers = getAuthHeader();
    return axios.get('/api/v1/brand-products', { headers });
}

// MS3 revisit: brand creation is paused because brand-specific expiry requires curated shelf-life data.
// export const createBrand = (data) => {
//     const headers = getAuthHeader();
//     return axios.post('/api/v1/brand-products', data, { headers });
// }

export const getItemList = (params = {}) => {
    const headers = getAuthHeader();

    return axios.get('/api/v1/items', { headers, params });
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
