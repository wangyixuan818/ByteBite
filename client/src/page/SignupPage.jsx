 import {useState} from 'react';
 import axios from 'axios';
 import { Link } from 'react-router-dom'
 import { useAuthentication } from '../context/AuthenticationContext';
 import { useNavigate } from 'react-router-dom';

 export default function SignupPage() {
    const [display_name, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuthentication();
    const navigate = useNavigate();

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
            login(fakeResponse.user, fakeResponse.token);
            // temporarily commented out post for testing
            */
            const response = await axios.post("/api/v1/auth/signup", {display_name, email, password});
            login(response.data.user, response.data.token);

            navigate('/dashboard');
        } catch (err) {
            const code = err.response?.data?.error?.code; // API contract change: non-2xx responses wrap details in error.code.
            if (code === "VALIDATION_ERROR") {
                setError("Please make sure your email address is valid.");
            } else if (code === "EMAIL_ALREADY_EXISTS") {
                setError("This email is already in use.");
            } else {
                setError("Please try again.")
            }
        }

    };

    return (
        /* Codex minimal UI pass: shared, readable authentication panel. */
        <main className="auth-page">
            <Link className="brand-link" to="/">ByteBite</Link>
            <form className="panel form-stack auth-panel" onSubmit={handleRequest}>
                <div><h1>Create account</h1><p>Start with a fresh household inventory.</p></div>
                {error ? <p className="message error" role="alert">{error}</p>: null}
                <label>Display name<input type='text' value={display_name} onChange={e => setDisplayName(e.target.value)} placeholder='Your name' required/></label>
                <label>Email<input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
                <label>Password<input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required /></label>
                <button className="button" type='submit'>Sign up</button>
                <Link to="/login">Already have an account? Log in</Link>
            </form>
        </main>
    );
 }
