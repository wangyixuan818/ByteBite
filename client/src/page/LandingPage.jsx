import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthentication } from "../context/AuthenticationContext";
import pepperHero from "../assets/bytebite-ui-v2/hero/pepper.png";
import cornHero from "../assets/bytebite-ui-v2/hero/corn.png";
import meatHero from "../assets/bytebite-ui-v2/hero/meat.png";
import lemonHero from "../assets/bytebite-ui-v2/hero/lemon.png";
import lettuceHero from "../assets/bytebite-ui-v2/hero/lettuce.png";

const floatingFoods = [
    { name: "Pepper", src: pepperHero, className: "hero-food pepper" },
    { name: "Lemon", src: lemonHero, className: "hero-food lemon" },
    { name: "Lettuce", src: lettuceHero, className: "hero-food lettuce" },
    { name: "Meat", src: meatHero, className: "hero-food meat" },
    { name: "Corn", src: cornHero, className: "hero-food corn" },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { user, loading } = useAuthentication();

    useEffect(() => {
        if (!loading && user) {
            navigate("/dashboard");
        }
    }, [user, loading, navigate]);

    if (loading) {
        return <main className="landing-loading">Loading ByteBite...</main>;
    }

    return (
        <main className="landing-page">
            <section className="landing-hero" aria-labelledby="landing-title">
                <nav className="landing-nav" aria-label="Primary">
                    <button className="landing-brand" onClick={() => navigate("/")}>
                        <span>ByteBite</span>
                    </button>
                    <div className="landing-nav-actions">
                        <button className="landing-link-button" onClick={() => navigate("/login")}>Log in</button>
                        <button className="landing-button small" onClick={() => navigate("/signup")}>Sign up</button>
                    </div>
                </nav>

                <div className="landing-hero-content">
                    <div className="hero-copy">
                        <h1 id="landing-title">
                            <span className="outline-line">Track Less.</span>
                            <span>Waste Less.</span>
                        </h1>
                    </div>

                    <aside className="hero-intro" aria-label="ByteBite introduction">
                        <h2>Fridge Tracker</h2>
                        <p>
                            Turn forgotten groceries into smarter choices. ByteBite helps households reduce food waste through simple inventory tracking and expiry alerts.
                        </p>
                        <button className="landing-button" onClick={() => navigate("/signup")}>Get Started For Free</button>
                    </aside>
                </div>

                <div className="food-float-row" aria-hidden="true">
                    {floatingFoods.map((food, index) => (
                        <span
                            className={food.className}
                            key={food.name}
                            style={{ "--i": index }}
                        >
                            <img src={food.src} alt="" draggable="false" />
                        </span>
                    ))}
                </div>
            </section>
        </main>
    );
}
