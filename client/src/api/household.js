import { client } from './client';
import { getAuthHeader } from '../context/AuthenticationContext';

function authConfig() {
    return { headers: getAuthHeader() };
}

export function getHouseholds() {
    return client.get('/api/v1/households', authConfig());
}

export function createHousehold(name) {
    return client.post('/api/v1/households', { name }, authConfig());
}

export function joinHousehold(code) {
    return client.post('/api/v1/households/join', { code }, authConfig());
}

export function renameHousehold(id, name) {
    return client.patch(`/api/v1/households/${id}`, { name }, authConfig());
}

export function leaveHousehold(id) {
    return client.delete(`/api/v1/households/${id}/members/me`, authConfig());
}

export function regenerateHouseholdCode(id) {
    return client.post(`/api/v1/households/${id}/regenerate-code`, {}, authConfig());
}
