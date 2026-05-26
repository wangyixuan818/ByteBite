import {createContext, useContext, useEffect, useState} from 'react';
import axios from 'axios';

const AuthenticationContext = createContext(null);

export function AuthenticationProvider({children}) {
    const [user, setUser] = useState(null); 
    const [loading, setLoading] = useState(true);
    // back to login while it's still processing

    // when user refreshes the page (this is to keep user logged in):
    useEffect(() => {
        const token = localStorage.getItem('authenticationToken');

        if (!token) { // no token
            setLoading(false); //skip
            return;
        }
        //TODO: replace the placeholder
        // Commented out for testing now
       /* axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}`}
        })
        .then(res => setUser(res.data.user))
        .catch(() => localStorage.removeItem('authenticationToken'))
        .finally(() => setLoading(false)); 
        */
       setUser({ id: 1, email: "test@test.com", display_name: "Test User" });
       setLoading(false);
    }, []);


    const login = (user, token) => {
        localStorage.setItem('authenticationToken', token);
        setUser(user);
    }

    const logout = () => {
        const token = localStorage.getItem('authenticationToken');

        axios.post('/api/auth/logout', {}, {
            headers: { Authorization: 'Bearer ${token}' }
        }).catch(() => {});

        localStorage.removeItem('authenticationToken');
        setUser(null);
    };


    return (
        <AuthenticationContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthenticationContext.Provider>
    );

}

// shorthand hook
export const useAuthentication = () => useContext(AuthenticationContext);

