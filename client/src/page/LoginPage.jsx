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
            const code = err.response?.data?.error.code;
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
        <div>
            <h1>ByteBite</h1>
            <form onSubmit={handleRequest}>
                {error ? <p>{error}</p>: null}
                <input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
                <br />
                <input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                <br />
                <button type='submit'>Log In</button>
                <br />
                <Link to="/signup">Don't have an account yet? Sign up now</Link>
            </form>
        </div>
    );
 }