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
    }, [user, loading, navigate]);

    if (loading) {
        return <p>Loading...</p>;
    } else {
        return (
            <main className="page-shell">
                <nav className="topbar">
                    <strong>ByteBite</strong>
                    <div className="button-row">
                        <button className="button secondary" onClick={() => navigate('/login')}>Log in</button>
                        <button className="button" onClick={() => navigate('/signup')}>Sign up</button>
                    </div>
                </nav>
                <section className="landing-grid">
                    <div>
                        <p className="eyebrow">Fridge inventory and expiry helper</p>
                        <h1>Track less. Waste less.</h1>
                        <p>Keep a simple inventory, see what expires first, and find ideas for what to use next.</p>
                        <div className="button-row landing-actions">
                            <button className="button" onClick={() => navigate('/signup')}>Get started</button>
                            <button className="button secondary" onClick={() => navigate('/login')}>Log in</button>
                        </div>
                    </div>
                    <div className="preview-card" aria-label="ByteBite feature preview">
                        <div className="mini-fridge"><span>Fridge</span><span>Freezer</span></div>
                        <div><strong>Expiring soon</strong><p>Milk · 1 day</p><p>Spinach · 3 days</p></div>
                    </div>
                </section>
            </main>
        );
    }
}
