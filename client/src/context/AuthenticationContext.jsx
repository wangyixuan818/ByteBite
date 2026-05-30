import {createContext, useContext, useEffect, useState} from 'react';
import axios from 'axios';

const AuthenticationContext = createContext(null);

export const getAuthHeader = () => {
    const token = localStorage.getItem('authenticationToken');

    if (!token) { return null; }
    return { Authorization: `Bearer ${token}`};
}

export function AuthenticationProvider({children}) {
    const [user, setUser] = useState(null); 
    const [loading, setLoading] = useState(true);
    // back to login while it's still processing

    // when user refreshes the page (this is to keep user logged in):
    useEffect(() => {
       const headers = getAuthHeader();
       if (!headers) {
        setLoading(false);
        return;
       }
       axios.get('/api/v1/auth/me', { headers})
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem('authenticationToken'))
        .finally(() => setLoading(false)); 
        
       // wrote for testing (fake response)
       // setUser({ id: 1, email: "test@test.com", display_name: "Test User" });
       // setLoading(false);
    }, []);


    const login = (user, token) => {
        localStorage.setItem('authenticationToken', token);
        setUser(user);
    }

    const logout = () => {
        const headers = getAuthHeader();
        // we clear client state regardless of response
        axios.post('/api/v1/auth/logout', {}, { headers })
          .catch(() => {});

        localStorage.removeItem('authenticationToken');
        setUser(null);
    };


    return (
        <AuthenticationContext.Provider value={{ user, loading, login, logout, getAuthHeader}}>
            {children}
        </AuthenticationContext.Provider>
    );

}

// shorthand hook
export const useAuthentication = () => useContext(AuthenticationContext);

