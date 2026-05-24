 import {useState} from 'react';
 import axios from 'axios';
 import { Link } from 'react-router-dom'

 export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleRequest = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const response = await axios.post("https://jsonplaceholder.typicode.com/posts", {email, password});
            // TODO: finish authentication and navigation to dashboard
        } catch (err) {
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