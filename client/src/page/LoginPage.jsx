 import {useState} from 'react';
 import axios from 'axios';
 import { Link } from 'react-router-dom';
 import { useAuthentication } from '../context/AuthenticationContext';
 import { useNavigate } from 'react-router-dom';

 export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { login } = useAuthentication();

    const handleRequest = async (e) => {
        e.preventDefault();
        setError("");

        if (password.length < 8) {
            setError("Password length must be at least 8 characters");
            return;
        }

        try {
            /*
            const fakeResponse = {
                user: { id: 1, email: email, display_name: "Test User" },
                token: "fake-token-123"
            };
            login(fakeResponse.user, fakeResponse.token); for testing
            //temporarily commented out post for testing
            */
            const response = await axios.post("/api/v1/auth/login", {email, password});
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.log(err);
            const code = err.response?.data?.error?.code; // API contract change: non-2xx responses wrap details in error.code.
            if (code === 'INVALID_USER') {
                setError("Invalid user.");
            } else if (code === 'INVALID_PASSWORD') {
                setError("Incorrect password.");
            } else if (code === 'VALIDATION_ERROR') {
                setError("Incorrect input format.");
            } else {    
                setError("Please try again.");
            }
        } finally {
            //
        }
    }
    return (
        /* Codex minimal UI pass: shared, readable authentication panel. */
        <main className="auth-page">
            <Link className="brand-link" to="/">ByteBite</Link>
            <form className="panel form-stack auth-panel" onSubmit={handleRequest}>
                <div><h1>Log in</h1><p>Welcome back to your fridge.</p></div>
                {error ? <p className="message error" role="alert">{error}</p>: null}
                <label>Email<input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
                <label>Password<input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required /></label>
                <button className="button" type='submit'>Log in</button>
                <Link to="/signup">Don't have an account? Sign up</Link>
            </form>
        </main>
    );
 }
