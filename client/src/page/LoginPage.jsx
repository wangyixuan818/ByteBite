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

        try {
            const fakeResponse = {
                user: { id: 1, email: email, display_name: "Test User" },
                token: "fake-token-123"
            };
            // temporarily commented out post for testing
            // remember to replace the placeholder
            // const response = await axios.post("https://jsonplaceholder.typicode.com/posts", {email, password});
            // login(response.data.user, response.data.token);

            login(fakeResponse.user, fakeResponse.token);
            navigate('/dashboard');
        } catch (err) {
            console.log(err);
            const code = err.response?.data?.code;
            if (code === "INVALID_CREDENTIALS") {
                setError("Incorrect login information");
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