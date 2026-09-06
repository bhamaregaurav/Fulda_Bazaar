import '../Style/pages/signin.scss';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store';
import { login, resetStatus } from '../features/auth/authSlice';
import type { RootState } from '../store/store';
import { ROUTES } from '../constants/routes';

interface SigninDetails {
    email: string;
    password: string;
}

export const Signin = () => {
    const [signinDetails, setSigninDetail] = useState<SigninDetails>({ email: '', password: '' });
    const [emailUsername, setEmailUsername] = useState('');
    const [error, setError] = useState<boolean>(false);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const hasNavigated = useRef(false);

    const { status, error: authError, requires2FA, tempToken } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        // Only trigger navigation when login succeeds and we haven't navigated yet
        if (status === 'succeeded' && !hasNavigated.current) {
            hasNavigated.current = true; // Set flag immediately to prevent re-runs

            if (requires2FA && tempToken) {
                navigate(ROUTES.TWO_FA_VERIFY, {
                    state: { tempToken },
                    replace: true
                });
                // Reset status to prevent re-triggering
                dispatch(resetStatus());
            } else if (!requires2FA) {
                navigate(ROUTES.APP, { replace: true });
                // Reset status to prevent re-triggering
                dispatch(resetStatus());
            }
        }
    }, [status, requires2FA, tempToken, navigate, dispatch]); // Include all dependencies

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(false);
        const { name, value } = e.target;

        if (name === 'email') {
            setEmailUsername(value);
        } else {
            setSigninDetail({ ...signinDetails, [name]: value });
        }
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        hasNavigated.current = false; // Reset navigation flag
        const email = `${emailUsername}@hs-fulda.de`;
        dispatch(login({ email, password: signinDetails.password }));
    };

    return (
        <div className="signin-container">
            <div className="signin-card">
                <h1>Sign In</h1>
                {(error || authError) && (
                    <div className="error-message">
                        {authError || 'Please check your credentials and try again'}
                    </div>
                )}
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <div className="email-input-group">
                            <input
                                type="text"
                                id="email"
                                name="email"
                                className="email-username"
                                value={emailUsername}
                                onChange={handleInputChange}
                                required
                            />
                            <div className="email-domain">@hs-fulda.de</div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password:</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={signinDetails.password}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <button
                        className="signin-submit-button"
                        type="submit"
                        disabled={status === 'loading'}>
                        {status === 'loading' ? 'Signing in...' : 'Sign In'}
                    </button>
                    <div className="auth-links">
                        <p className="forgot-password">
                            <Link to={ROUTES.FORGOT_PASSWORD}>Forgot Password?</Link>
                        </p>
                        <div className="signup-link">
                            Don't have an account? <Link to={ROUTES.SIGN_UP}>Sign Up</Link>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
