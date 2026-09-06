import React, { useState } from 'react';
import { useAppDispatch } from '../store';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { disable2FA } from '../features/auth/authSlice';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../Style/components/twofa-settings.scss';

interface TwoFASettingsProps {
    user: {
        two_fa: boolean;
    };
    onTwoFAStatusChange?: () => void;
}

export const TwoFASettings: React.FC<TwoFASettingsProps> = ({ user, onTwoFAStatusChange }) => {
    const [showDisableForm, setShowDisableForm] = useState(false);
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState<string[]>(new Array(6).fill(''));
    const [error, setError] = useState('');

    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { status } = useSelector((state: RootState) => state.auth);

    const handleEnable2FA = () => {
        navigate(ROUTES.TWO_FA_SETUP);
    };

    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return;

        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);

        if (value && index < 5) {
            const nextInput = document.getElementById(`disable-2fa-${index + 2}`);
            nextInput?.focus();
        }
    };

    const handleDisable2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = verificationCode.join('');

        if (!password || code.length !== 6) {
            setError('Please fill in all required fields');
            return;
        }

        try {
            await dispatch(disable2FA({ password, code })).unwrap();
            setShowDisableForm(false);
            setPassword('');
            setVerificationCode(new Array(6).fill(''));
            setError('');
            onTwoFAStatusChange?.();
        } catch (error: any) {
            setError(error || 'Failed to disable 2FA');
        }
    };

    const cancelDisable = () => {
        setShowDisableForm(false);
        setPassword('');
        setVerificationCode(new Array(6).fill(''));
        setError('');
    };

    return (
        <div className="twofa-settings">
            <div className="setting-header">
                <div className="setting-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" fill="#3cb371" />
                    </svg>
                </div>
                <div className="setting-info">
                    <h3>Two-Factor Authentication</h3>
                    <p>Add an extra layer of security to your account with 2FA</p>
                </div>
                <div className="setting-status">
                    <span className={`status-badge ${user.two_fa ? 'enabled' : 'disabled'}`}>
                        {user.two_fa ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>

            {!showDisableForm && (
                <div className="setting-actions">
                    {!user.two_fa ? (
                        <button
                            onClick={handleEnable2FA}
                            className="enable-btn"
                        >
                            Enable 2FA
                        </button>
                    ) : (
                        <div className="enabled-actions">
                            <p className="enabled-description">
                                Your account is protected with two-factor authentication.
                                You'll need to enter a code from your authenticator app when signing in.
                            </p>
                            <button
                                onClick={() => setShowDisableForm(true)}
                                className="disable-btn"
                            >
                                Disable 2FA
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showDisableForm && (
                <div className="disable-form">
                    <h4>Disable Two-Factor Authentication</h4>
                    <p>To disable 2FA, please confirm your identity:</p>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleDisable2FA}>
                        <div className="form-group">
                            <label htmlFor="disable-password">Current Password:</label>
                            <input
                                type="password"
                                id="disable-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>2FA Code from your authenticator app:</label>
                            <div className="code-inputs">
                                {[1, 2, 3, 4, 5, 6].map((num, index) => (
                                    <input
                                        key={num}
                                        id={`disable-2fa-${num}`}
                                        type="number"
                                        maxLength={1}
                                        inputMode="numeric"
                                        pattern="[\d]*"
                                        value={verificationCode[index]}
                                        onChange={(e) => handleCodeChange(index, e.target.value)}
                                        required
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={cancelDisable}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="confirm-disable-btn"
                            >
                                {status === 'loading' ? 'Disabling...' : 'Disable 2FA'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
