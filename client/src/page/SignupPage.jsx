 import {useState} from 'react';
 import axios from 'axios';
 import { Link } from 'react-router-dom'

 export default function SignupPage() {
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleRequest = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const response = await axios.post("https://jsonplaceholder.typicode.com/posts", {displayName, email, password});
            // TODO: authentication and redirect to other pages
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
                <input type='text' value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder='Display Name' required/>      
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