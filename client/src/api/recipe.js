import { client } from './client'
import { getAuthHeader } from '../context/AuthenticationContext';

export const getRecipeList = () => {
    const headers = getAuthHeader();
    return client.get('/api/v1/recipes', { headers }).then(response => response.data);
};

export const getRecipe = (id) => {
    const headers = getAuthHeader();
    return client.get(`/api/v1/recipes/${id}`, { headers }).then(response => response.data.recipe ?? response.data.result);
};
