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

        try {
            const fakeResponse = {
                user: { id: 1, email: email, display_name: "Test User" },
                token: "fake-token-123"
            };
            // temporarily commented out post for testing
            // const response = await axios.post("https://jsonplaceholder.typicode.com/posts", {display_name, email, password});
            // login(response.data.user, response.data.token);

            login(fakeResponse.user, fakeResponse.token);
            navigate('/dashboard');
        } catch (err) {
            const code = err.response?.data?.code;
            if (code === "VALIDATION_ERROR") {
                setError("Please check you inputs. Password must be at least 8 characters.");
            } else if (code === "EMAIL_TAKEN") {
                setError("This email is already in use.");
            } else {
                setError("Please try again.")
            }
        }

    };

    return (
        <div>
            <h1>ByteBite</h1>
            <form onSubmit={handleRequest}>
                {error ? <p>{error}</p>: null}
                <input type='text' value={display_name} onChange={e => setDisplayName(e.target.value)} placeholder='Display Name' required/>      
                <br />
                <input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
                <br />
                <input type='password' value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                <br />
                <button type='submit'>Sign up</button>
                <br />
                <Link to="/login">Already have an account? Log in now</Link>
            </form>
        </div>
    );
 }