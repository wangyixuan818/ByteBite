/* eslint-disable react-refresh/only-export-components -- existing context module intentionally shares provider helpers */
import {createContext, useContext, useEffect, useState} from 'react';
import { client } from '../api/client';
import { setCurrentHouseholdId } from '../utils/currentHousehold';

const AuthenticationContext = createContext(null);
const CURRENT_FRIDGE_KEY = 'bytebite-current-fridge-id';

export const getAuthHeader = () => {
    const token = localStorage.getItem('authenticationToken');

    if (!token) { return null; }
    return { Authorization: `Bearer ${token}`};
}

export function AuthenticationProvider({children}) {
    const [user, setUser] = useState(null); 
    const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('authenticationToken')));
    // back to login while it's still processing

    // when user refreshes the page (this is to keep user logged in):
    useEffect(() => {
       const headers = getAuthHeader();
       if (!headers) {
        return;
       }
       client.get('/api/v1/auth/me', { headers})
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem('authenticationToken'))
        .finally(() => setLoading(false)); 
        
       // wrote for testing (fake response)
       // setUser({ id: 1, email: "test@test.com", display_name: "Test User" });
       // setLoading(false);
    }, []);


    const login = (user, token) => {
        localStorage.setItem('authenticationToken', token);
        setCurrentHouseholdId(null);
        localStorage.removeItem(CURRENT_FRIDGE_KEY);
        setUser(user);
    }

    const logout = () => {
        const headers = getAuthHeader();
        // we clear client state regardless of response
        client.post('/api/v1/auth/logout', {}, { headers })
          .catch(() => {});

        localStorage.removeItem('authenticationToken');
        setCurrentHouseholdId(null);
        localStorage.removeItem(CURRENT_FRIDGE_KEY);
        setUser(null);
    };

    const updateUser = (nextUser) => {
        setUser(nextUser);
    };

    return (
        <AuthenticationContext.Provider value={{ user, loading, login, logout, updateUser, getAuthHeader}}>
            {children}
        </AuthenticationContext.Provider>
    );

}

// shorthand hook
export const useAuthentication = () => useContext(AuthenticationContext);

