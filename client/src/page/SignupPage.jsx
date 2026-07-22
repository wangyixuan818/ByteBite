import { useState } from 'react';
import { client } from '../api/client';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthentication } from '../context/AuthenticationContext';
import BrandTitle from '../components/BrandTitle';

export default function SignupPage() {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmPw, setConfirmPw] = useState('')
    const { login } = useAuthentication();
    const navigate = useNavigate();

    const handleRequest = async (event) => {
        event.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password length must be at least 8 characters.');
            return;
        }

        if (confirmPw !==  password) {
            setError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const response = await client.post('/api/v1/auth/signup', {
                display_name: displayName,
                email,
                password,
            });
            login(response.data.user, response.data.token);
            navigate('/dashboard');
        } catch (err) {
            const code = err.response?.data?.error?.code;
            if (code === 'VALIDATION_ERROR') {
                setError('Please make sure your email address is valid.');
            } else if (code === 'EMAIL_ALREADY_EXISTS') {
                setError('This email is already in use.');
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
                    <p className="auth-kicker">Create account</p>
                    <h1>Sign up</h1>
                    <p>Start a simple household inventory before the next grocery run.</p>
                </div>

                <form className="form-stack" onSubmit={handleRequest}>
                    {error && <p className="message error" role="alert">{error}</p>}

                    <label>
                        Display name
                        <input type="text" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Display Name" required />
                    </label>

                    <label>
                        Email
                        <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" required />
                    </label>

                    <label>
                        Password
                        <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" required />
                    </label>

                    <label>
                        Reconfirm password
                        <input type="password" value={confirmPw} onChange={event => setConfirmPw(event.target.value)} placeholder="Confirm your password again" required />
                    </label>

                    <button className="button" type="submit" disabled={submitting}>
                        {submitting ? 'Creating account...' : 'Sign up'}
                    </button>

                    <p className="auth-helper">
                        Already have an account? <Link to="/login">Log in now</Link>
                    </p>
                </form>
            </section>
        </main>
    );
}
