import { useState, useEffect } from 'react';
import '../Style/pages/signup.scss';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch } from '../store';
import removeIcon from '../../public/remove.svg';
import { login } from '../features/auth/authSlice';
import { API_BASE_URL } from '../../config';
import { ROUTES } from '../constants/routes';

interface SignupDetails {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  profile_picture?: File | null;
}

interface PasswordValidation {
  minLength: boolean;
  hasUpperCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
}

export const Signup = () => {
  const [userDetail, setUserDetail] = useState<SignupDetails>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    profile_picture: null
  });
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [emailUsername, setEmailUsername] = useState('');
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState('Please fill in all fields correctly');
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUpperCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isValid: false
  });
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Validate password whenever it changes
  useEffect(() => {
    const password = userDetail.password;
    const validations = {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const isValid = Object.values(validations).every(Boolean);

    setPasswordValidation({
      ...validations,
      isValid
    });
  }, [userDetail.password]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'email') {
      setEmailUsername(value);
    } else {
      setUserDetail({
        ...userDetail,
        [name]: value
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
    }
  };

  const removeImage = () => {
    setProfileImage(null);
  };

  const handleUserRegistration = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const { first_name, last_name, password } = userDetail;
    const email = emailUsername ? `${emailUsername.trim()}@hs-fulda.de` : '';

    // Check if email username is empty after trimming
    if (!emailUsername.trim()) {
      setErrorMessage('Please enter your email username');
      setError(true);
      return;
    }

    // Check if password meets requirements
    if (!passwordValidation.isValid) {
      setErrorMessage('Password does not meet the requirements');
      setError(true);
      return;
    }

    // Check if any field is empty after trimming
    if (first_name.trim() && last_name.trim() && emailUsername.trim() && password.trim()) {
      try {
        // Create FormData object for sending multipart/form-data
        const formData = new FormData();
        formData.append('first_name', first_name.trim());
        formData.append('last_name', last_name.trim());
        formData.append('email', email);
        formData.append('password', password.trim());
        
        // Only append profile picture if it exists
        if (profileImage) {
          formData.append('profile_picture', profileImage);
        }

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          // Don't set Content-Type header, browser will set it with boundary
          body: formData
        });

        if (response.ok) {
          await response.json(); // We don't need to store the response data
          // After successful registration, log the user in
          dispatch(login({ email, password: password.trim() }));
          navigate(ROUTES.APP); // Navigate to app page after successful registration
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.detail || 'Registration failed');
          setError(true);
        }
      } catch (error) {
        console.error('Error:', error);
        setErrorMessage('An unexpected error occurred');
        setError(true);
      }
    } else {
      setErrorMessage('Please fill in all fields with valid text (not just spaces)');
      setError(true);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1>Sign Up</h1>
        {error && (
          <p className="error-message">{errorMessage}</p>
        )}
        <form onSubmit={handleUserRegistration}>
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={userDetail.first_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={userDetail.last_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="email-input-group">
              <input
                type="text"
                id="email"
                name="email"
                value={emailUsername}
                onChange={handleChange}
                className="email-username"
                required
              />
              <div className="email-domain">@hs-fulda.de</div>
            </div>
          </div>
          <div className="form-group">
            {!profileImage && (
              <label className="signup-custom-file-upload" htmlFor="file">
                <div className="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="" viewBox="0 0 24 24">
                    <g stroke-width="0" id="SVGRepo_bgCarrier"></g>
                    <g
                      stroke-linejoin="round"
                      stroke-linecap="round"
                      id="SVGRepo_tracerCarrier"
                    ></g>
                    <g id="SVGRepo_iconCarrier">
                      {' '}
                      <path
                        fill=""
                        d="M10 1C9.73478 1 9.48043 1.10536 9.29289 1.29289L3.29289 7.29289C3.10536 7.48043 3 7.73478 3 8V20C3 21.6569 4.34315 23 6 23H7C7.55228 23 8 22.5523 8 22C8 21.4477 7.55228 21 7 21H6C5.44772 21 5 20.5523 5 20V9H10C10.5523 9 11 8.55228 11 8V3H18C18.5523 3 19 3.44772 19 4V9C19 9.55228 19.4477 10 20 10C20.5523 10 21 9.55228 21 9V4C21 2.34315 19.6569 1 18 1H10ZM9 7H6.41421L9 4.41421V7ZM14 15.5C14 14.1193 15.1193 13 16.5 13C17.8807 13 19 14.1193 19 15.5V16V17H20C21.1046 17 22 17.8954 22 19C22 20.1046 21.1046 21 20 21H13C11.8954 21 11 20.1046 11 19C11 17.8954 11.8954 17 13 17H14V16V15.5ZM16.5 11C14.142 11 12.2076 12.8136 12.0156 15.122C10.2825 15.5606 9 17.1305 9 19C9 21.2091 10.7909 23 13 23H20C22.2091 23 24 21.2091 24 19C24 17.1305 22.7175 15.5606 20.9844 15.122C20.7924 12.8136 18.858 11 16.5 11Z"
                        clip-rule="evenodd"
                        fill-rule="evenodd"
                      ></path>{' '}
                    </g>
                  </svg>
                </div>
                <div className="signup-custom-file-upload-text">
                  <span>Click to upload profile photo</span>
                </div>
                <input
                  type="file"
                  name="images"
                  id="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            )}
            {profileImage && (
              <div className="file-preview-container">
                <div className="file-preview-item">
                  <img
                    className="file-preview-image"
                    src={URL.createObjectURL(profileImage)}
                  />
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeImage()}
                  >
                    <img src={removeIcon} alt="Remove" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={userDetail.password}
              onChange={handleChange}
              required
            />
            <div className="password-requirements">
              <p className={passwordValidation.minLength ? 'valid' : 'invalid'}>
                <span className="validation-icon">{passwordValidation.minLength ? '✓' : '✗'}</span>
                At least 8 characters
              </p>
              <p className={passwordValidation.hasUpperCase ? 'valid' : 'invalid'}>
                <span className="validation-icon">{passwordValidation.hasUpperCase ? '✓' : '✗'}</span>
                At least one uppercase letter
              </p>
              <p className={passwordValidation.hasNumber ? 'valid' : 'invalid'}>
                <span className="validation-icon">{passwordValidation.hasNumber ? '✓' : '✗'}</span>
                At least one number
              </p>
              <p className={passwordValidation.hasSpecialChar ? 'valid' : 'invalid'}>
                <span className="validation-icon">{passwordValidation.hasSpecialChar ? '✓' : '✗'}</span>
                At least one special character
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={!passwordValidation.isValid}
            className={`signup-submit-button ${!passwordValidation.isValid ? 'disabled' : ''}`}
          >
            Sign Up
          </button>
          <div className="auth-links">
            <div className="signin-link">
              Already have an account? <Link to={ROUTES.SIGN_IN}>Sign In</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
