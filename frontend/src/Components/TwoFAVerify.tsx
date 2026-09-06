import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { verify2FA } from '../features/auth/authSlice';
import '../Style/pages/twofa-verify.scss';
import { ROUTES } from '../constants/routes';

interface LocationState {
    tempToken?: string;
}

export const TwoFAVerify = () => {
    const [verificationCode, setVerificationCode] = useState<string[]>(new Array(6).fill(''));
    const [error, setError] = useState<string>('');
    const hasNavigated = useRef(false);

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { status } = useSelector((state: RootState) => state.auth);

    const state = location.state as LocationState;
    const tempToken = state?.tempToken;

    useEffect(() => {
        // Redirect if no temp token, but only once
        if (!tempToken && !hasNavigated.current) {
            hasNavigated.current = true;
            navigate(ROUTES.SIGN_IN, { replace: true });
        }
    }, [tempToken, navigate]);

    useEffect(() => {
        if (status === 'succeeded' && !hasNavigated.current) {
            hasNavigated.current = true;
            navigate(ROUTES.APP, { replace: true });
        }
    }, [status, navigate]);

    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return; // Only allow single digit

        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`2fa-${index + 2}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        // Handle backspace
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`2fa-${index}`);
            prevInput?.focus();
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = verificationCode.join('');

        if (code.length !== 6) {
            setError('Please enter a complete 6-digit code');
            return;
        }

        if (!tempToken) {
            setError('Session expired. Please sign in again.');
            hasNavigated.current = true;
            navigate(ROUTES.SIGN_IN, { replace: true });
            return;
        }

        try {
            hasNavigated.current = false; // Reset navigation flag before verification
            await dispatch(verify2FA({ tempToken, code })).unwrap();
        } catch (error: any) {
            setError(error || 'Invalid verification code');
            setVerificationCode(new Array(6).fill(''));
        }
    };

    const handleBackToSignin = () => {
        hasNavigated.current = true;
        navigate(ROUTES.SIGN_IN, { replace: true });
    };

    return (
        <div className="twofa-verify-container">
            <div className="twofa-verify-card">
                <div className="security-header">
                    <div className="security-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" fill="#3cb371" />
                        </svg>
                    </div>
                    <h1>Security check</h1>
                    <p className="subtitle">Enter your 2FA security token to continue</p>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleVerify2FA}>
                    <fieldset>
                        <legend id="legend-2fa">2FA security token</legend>
                        <div className="form__group form__pincode">
                            {[1, 2, 3, 4, 5, 6].map((num, index) => (
                                <label key={num} aria-label={`number ${num}`}>
                                    <input
                                        id={`2fa-${num}`}
                                        type="number"
                                        name={`pincode-${num}`}
                                        maxLength={1}
                                        inputMode="numeric"
                                        pattern="[\d]*"
                                        placeholder="•"
                                        autoComplete="off"
                                        value={verificationCode[index]}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        required
                                    />
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="button-group">
                        <button
                            type="button"
                            onClick={handleBackToSignin}
                            className="back-btn"
                        >
                            Back to Sign In
                        </button>
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="verify-btn"
                        >
                            {status === 'loading' ? 'Verifying...' : 'Verify & Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
