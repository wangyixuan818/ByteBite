import { client } from './client';
import { getAuthHeader } from '../context/AuthenticationContext';
import { getCurrentHouseholdId, withCurrentHouseholdParams } from '../utils/currentHousehold';

const activeHouseholdConfig = (params = {}) => ({
    headers: getAuthHeader(),
    params: withCurrentHouseholdParams(params),
});

export function getFridges() {
    return client.get('/api/v1/fridges', activeHouseholdConfig());
}

export function initializeFridge(data) {
    const householdId = getCurrentHouseholdId();
    const body = householdId ? { ...data, household_id: Number(householdId) } : data;
    return client.post('/api/v1/fridges/initialize', body, { headers: getAuthHeader() });
}
