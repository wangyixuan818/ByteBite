import {useContext, useEffect} from 'react';
import { useAuthentication } from "../context/AuthenticationContext";

export default function Dashboard() {
    const { user, logout } = useAuthentication();

    return (
        <div>
            <h1>Welcome {user.display_name}</h1>
            <br />
            <button onClick={logout}>Logout</button>
        </div>
    );
}