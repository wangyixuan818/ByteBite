const CURRENT_HOUSEHOLD_KEY = 'bytebite-current-household-id';

export function getCurrentHouseholdId() {
    return localStorage.getItem(CURRENT_HOUSEHOLD_KEY);
}

export function setCurrentHouseholdId(householdId) {
    if (householdId) {
        localStorage.setItem(CURRENT_HOUSEHOLD_KEY, String(householdId));
    } else {
        localStorage.removeItem(CURRENT_HOUSEHOLD_KEY);
    }
}

export function withCurrentHouseholdParams(params = {}) {
    const householdId = getCurrentHouseholdId();
    return householdId ? { ...params, household_id: Number(householdId) } : params;
}
