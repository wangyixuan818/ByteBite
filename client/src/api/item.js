import { client } from './client'
import { getAuthHeader } from "../context/AuthenticationContext";
import { getCurrentHouseholdId, withCurrentHouseholdParams } from '../utils/currentHousehold';

const activeHouseholdConfig = (params = {}) => ({
    headers: getAuthHeader(),
    params: withCurrentHouseholdParams(params),
});

const activeHouseholdBody = (data = {}) => {
    const householdId = getCurrentHouseholdId();
    return householdId ? { ...data, household_id: Number(householdId) } : data;
};

export const getFoodTypes = () => {
    return client.get('/api/v1/food-types', activeHouseholdConfig());
}

export const getCategories = () => {
    return client.get('/api/v1/categories', activeHouseholdConfig());
}

// TODO(backend): implement POST /categories, including optional multipart thumbnail handling.
export const createCategory = ({ name, default_storage = 'fridge' }) => {
    return client.post('/api/v1/categories', { name, default_storage }, activeHouseholdConfig());
}

// TODO(backend): implement POST /food-types and return { food_type }.
export const createFoodType = (data) => {
    return client.post('/api/v1/food-types', data, activeHouseholdConfig());
}

export const getBrands = () => {
    return client.get('/api/v1/brand-products', activeHouseholdConfig());
}

// MS3 revisit: brand creation is paused because brand-specific expiry requires curated shelf-life data.
// export const createBrand = (data) => {
//     const headers = getAuthHeader();
//     return axios.post('/api/v1/brand-products', data, { headers });
// }

export const getItemList = (params = {}) => {
    return client.get('/api/v1/items', activeHouseholdConfig(params));
}

export const addItem = (data) => {
    return client.post('/api/v1/items', activeHouseholdBody(data), activeHouseholdConfig());
}

export const getItem = (id) => {
    return client.get(`/api/v1/items/${id}`, activeHouseholdConfig());
}

export const updateItem = (id, data) => {
    return client.patch(`/api/v1/items/${id}`, data, activeHouseholdConfig());
}

export const deleteItem = (id) => {
    return client.delete(`/api/v1/items/${id}`, activeHouseholdConfig());
}

export const consumeItem = (id, quantity) => {
    const headers = getAuthHeader();
    return client.post(`/api/v1/items/${id}/consume`, quantity != null ? { quantity } : {}, { headers });
};

export const disposeItem = (id, quantity) => {
    const headers = getAuthHeader();
    return client.post(`/api/v1/items/${id}/dispose`, quantity != null ? { quantity } : {}, { headers });
};
