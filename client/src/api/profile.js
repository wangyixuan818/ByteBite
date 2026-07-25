import { client } from './client';
import { getAuthHeader } from '../context/AuthenticationContext';

export function updateProfile(profile) {
    return client.patch('/api/v1/auth/me', profile, { headers: getAuthHeader() });
}
