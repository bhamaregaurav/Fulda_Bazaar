import '../Style/pages/forgot-password.scss';

export const ForgotPassword = () => {
    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">

                <form>
                    <div className="form-group">
                        <label htmlFor="email">Enter your email. If your email exists, you'll receive a recovery email.</label>
                        <input type="email" id="email" name="email" required />
                    </div>
                    <button
                        className="forgot-password-submit-button"
                        type="submit">Send Recovery Email</button>
                </form>
            </div>
        </div>
    )
}