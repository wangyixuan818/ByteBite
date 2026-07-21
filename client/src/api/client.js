import axios from 'axios';

// empty baseURL locally, so requests stay relative and the Vite proxy handles them
// after deployment VITE_API_URL points at the deployed backend
export const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? '',
});