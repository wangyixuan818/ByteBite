import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';
import BrandTitle from '../components/BrandTitle';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuthentication();

    const handleRequest = async (event) => {
        event.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password length must be at least 8 characters.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await axios.post('/api/v1/auth/login', { email, password });
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            const code = err.response?.data?.error?.code;
            if (code === 'INVALID_USER') {
                setError('Invalid user.');
            } else if (code === 'INVALID_PASSWORD') {
                setError('Incorrect password.');
            } else if (code === 'VALIDATION_ERROR') {
                setError('Incorrect input format.');
            } else {
                setError('Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="auth-page">
            <BrandTitle className="auth-brand" to="/" />
            <section className="auth-panel">
                <div className="auth-copy">
                    <p className="auth-kicker">Welcome back</p>
                    <h1>Log in</h1>
                    <p>Open your fridge notes and pick up where your groceries left off.</p>
                </div>

                <form className="form-stack" onSubmit={handleRequest}>
                    {error && <p className="message error" role="alert">{error}</p>}

                    <label>
                        Email
                        <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" required />
                    </label>

                    <label>
                        Password
                        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" required />
                    </label>

                    <button className="button" type="submit" disabled={submitting}>
                        {submitting ? 'Logging in...' : 'Log in'}
                    </button>

                    <p className="auth-helper">
                        Don&apos;t have an account yet? <Link to="/signup">Sign up now</Link>
                    </p>
                </form>
            </section>
        </main>
    );
}
