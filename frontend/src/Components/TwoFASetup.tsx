import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import { setup2FA, confirm2FA } from '../features/auth/authSlice';
import '../Style/pages/twofa-setup.scss';
import { ROUTES } from '../constants/routes';

export const TwoFASetup = () => {
    const [step, setStep] = useState<'setup' | 'qr' | 'confirm'>('setup');
    const [qrCode, setQrCode] = useState<string>('');
    const [secret, setSecret] = useState<string>('');
    const [verificationCode, setVerificationCode] = useState<string[]>(new Array(6).fill(''));
    const [error, setError] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { status } = useSelector((state: RootState) => state.auth);

    const handleSetup2FA = async () => {
        try {
            setError('');
            const result = await dispatch(setup2FA()).unwrap();
            setQrCode(result.qr_svg);
            setSecret(result.secret);
            setStep('qr');
        } catch (error: any) {
            setError(error || 'Failed to setup 2FA');
        }
    };

    const handleContinueToConfirm = () => {
        setStep('confirm');
    };

    const handleCopySecret = async () => {
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        } catch (err) {
            console.error('Failed to copy secret:', err);
        }
    };

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

    const handleConfirm2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = verificationCode.join('');
        
        if (code.length !== 6) {
            setError('Please enter a complete 6-digit code');
            return;
        }

        try {
            await dispatch(confirm2FA({ code })).unwrap();
            navigate(ROUTES.PROFILE); // Redirect to profile after successful setup
        } catch (error: any) {
            setError(error || 'Invalid verification code');
            setVerificationCode(new Array(6).fill(''));
        }
    };

    return (
        <div className="twofa-setup-container">
            <div className="twofa-setup-card">
                {step === 'setup' && (
                    <div className="setup-header">
                        <h1>Set up two-factor authentication</h1>
                        <p className="subtitle">Add an extra layer of security to your account</p>
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {step === 'setup' && (
                    <div className="setup-step">
                        <div className="instruction-step">
                            <div className="step-number">1</div>
                            <div className="step-content">
                                <h3>Install an authenticator app</h3>
                                <p>Download Google Authenticator, Authy, or any compatible TOTP app on your phone.</p>
                            </div>
                        </div>

                        <div className="instruction-step">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h3>Ready to set up 2FA?</h3>
                                <p>Click the button below to generate your QR code and secret key.</p>
                            </div>
                        </div>

                        <div className="button-group">
                            <button 
                                type="button" 
                                onClick={() => navigate(ROUTES.PROFILE)}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSetup2FA}
                                disabled={status === 'loading'}
                                className="confirm-btn"
                            >
                                {status === 'loading' ? 'Setting up...' : 'Set up 2FA'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'qr' && (
                    <div className="qr-step">
                        <div className="instruction-step">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h3>Scan QR code</h3>
                                <p>Use your authenticator app to scan this QR code and add your account.</p>
                            </div>
                        </div>

                        <div className="qr-content">
                            <div className="qr-section">
                                {qrCode && (
                                    <div className="qr-code-container">
                                        <img 
                                            src={`data:image/png;base64,${qrCode}`}
                                            alt="QR Code for 2FA Setup"
                                            className="qr-code-image"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="manual-section">
                            <p className="manual-text">Can't scan? Enter this code into your authentication app</p>
                            <div 
                                className="secret-code" 
                                onClick={handleCopySecret}
                                title="Click to copy"
                            >
                                {secret}
                                {copied && <span className="copy-notification">Copied!</span>}
                            </div>
                        </div>

                        <div className="button-group">
                            <button 
                                type="button" 
                                onClick={() => navigate(ROUTES.PROFILE)}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleContinueToConfirm}
                                className="confirm-btn"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="confirm-step">
                        <div className="instruction-step">
                            <div className="step-number">3</div>
                            <div className="step-content">
                                <h3>Enter verification code</h3>
                                <p>Enter the 6-digit code from your authenticator app to complete setup.</p>
                            </div>
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleConfirm2FA}>
                            <fieldset>
                                <legend>2FA security token</legend>
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
                                    onClick={() => navigate(ROUTES.PROFILE)}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={status === 'loading'}
                                    className="confirm-btn"
                                >
                                    {status === 'loading' ? 'Verifying...' : 'Enable 2FA'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
