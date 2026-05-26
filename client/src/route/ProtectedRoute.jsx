import { Navigate, Outlet } from "react-router-dom";
import { useAuthentication } from "../context/AuthenticationContext";


export default function ProtectedRoute() {
    const {user, loading} = useAuthentication();

    if (loading) {
        return <p>Loading</p>;
    } else if (!user) {
        return <Navigate to='/login' />;
    } else {
        return <Outlet />;
    }
}