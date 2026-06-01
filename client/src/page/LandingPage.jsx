import { useNavigate } from "react-router-dom";
import { useAuthentication } from "../context/AuthenticationContext";
import { useEffect } from "react";

export default function LandingPage() {
    const navigate = useNavigate();
    const {user, loading} = useAuthentication();

    useEffect(() => {
        if (!loading && user) {
            navigate('/dashboard');
        }
    }, [user, loading]);

    if (loading) {
        return <p>Loading...</p>;
    } else {
        return (
            <div>
            <h1>ByteBite</h1>
            <br/>
            <button onClick={() => navigate('/login')}>Log in</button>
        </div>
        );
    }
}