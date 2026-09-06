import '../Style/pages/profile-page.scss';

import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Button } from './ui/button';
import { TwoFASettings } from './TwoFASettings';
import type { RootState } from '../store/store';
import { API_BASE_URL } from '../../config';

const PROFILE_VIEWING_TYPE = {
  DETAILS: 'details',
  SECURITY: 'security',
};

export const ProfilePage = () => {
  const { token, user } = useSelector((state: RootState) => state.auth);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    profile_picture: '',
    bio: '',
    two_fa: false,
  });
  const [newProfile, setNewProfile] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    profile_picture: '',
    bio: '',
    two_fa: false,
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileViewRadioValue, setProfileViewRadioValue] = useState(PROFILE_VIEWING_TYPE.DETAILS);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState<number>(0);

  const fetchProfile = async () => {
    if (!token) {
      setError('You must be logged in to view profile.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/view/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        let errorMessage = 'Failed to fetch profile';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch { }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone_number: data.phone_number || '',
        profile_picture: data.profile_picture || '',
        bio: data.bio || '',
        two_fa: data.two_fa || false,
      });
      setNewProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone_number: data.phone_number || '',
        profile_picture: data.profile_picture || '',
        bio: data.bio || '',
        two_fa: data.two_fa || false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRating = async () => {
    if (!token || !user?.user_id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/reviews/user/${user.user_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const reviews = await response.json();
        if (reviews.length > 0) {
          const total = reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
          const average = total / reviews.length;
          setAverageRating(Math.round(average * 10) / 10); // Round to 1 decimal place
          setTotalReviews(reviews.length);
        } else {
          setAverageRating(null);
          setTotalReviews(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user rating:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserRating();
  }, [token, user?.user_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };
  
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }
      
      // Check file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError('Only JPEG, PNG and GIF images are allowed');
        return;
      }
      
      setProfileImageFile(file);
      
      // Create a temporary URL for preview
      const fileUrl = URL.createObjectURL(file);
      setProfile(prev => ({ ...prev, profile_picture: fileUrl }));
    }
  };
  
  const removeProfilePicture = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/users/remove/profile-picture`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to remove profile picture');
      }
      
      setProfileImageFile(null);
      setProfile(prev => ({ ...prev, profile_picture: '' }));
      setSuccess('Profile picture removed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while removing profile picture');
    } finally {
      setLoading(false);
    }
  };

  const dataChanged = (prev: typeof profile, next: typeof profile) => {
    return (
      prev.first_name !== next.first_name ||
      prev.last_name !== next.last_name ||
      prev.phone_number !== next.phone_number ||
      prev.profile_picture !== next.profile_picture ||
      prev.bio !== next.bio
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      let updatedProfilePicture = profile.profile_picture;
      
      // If profile picture file has been selected, update it first
      if (profileImageFile) {
        const formData = new FormData();
        formData.append('profile_picture', profileImageFile);
        
        try {
          console.log('Uploading profile picture...');
          const pictureResponse = await fetch(`${API_BASE_URL}/users/update/profile-picture`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });
          
          if (!pictureResponse.ok) {
            let errorMessage = 'Failed to update profile picture';
            try {
              const errorData = await pictureResponse.json();
              errorMessage = errorData.detail || errorMessage;
            } catch (parseError) {
              console.error('Error parsing error response:', parseError);
            }
            throw new Error(errorMessage);
          }
          
          const pictureData = await pictureResponse.json();
          console.log('Profile picture updated successfully:', pictureData);
          
          // Update profile with new picture URL from response
          updatedProfilePicture = pictureData.profile_picture;
          setProfile(prev => ({ ...prev, profile_picture: pictureData.profile_picture }));
          
        } catch (profilePictureError) {
          console.error('Profile picture update error:', profilePictureError);
          setError(profilePictureError instanceof Error ? profilePictureError.message : 'Failed to update profile picture');
          setLoading(false);
          return; // Stop the submission process if picture upload fails
        }
      }
      
      // Always use a valid HTTP URL for profile_picture
      // If it's a blob URL or empty, use the original URL from newProfile
      const profilePictureToUse = 
        !updatedProfilePicture || updatedProfilePicture.startsWith('blob:')
          ? newProfile.profile_picture 
          : updatedProfilePicture;
      
      console.log('Using profile picture URL:', profilePictureToUse);
      
      // Update other profile information
      const payload = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        bio: profile.bio,
        profile_picture: profilePictureToUse || '',
      };
      
      console.log('Updating profile with payload:', payload);
      
      // Always send the update request to ensure profile is updated
      const response = await fetch(`${API_BASE_URL}/users/update/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update profile';
        try {
          const errorData = await response.json();
          console.error('Profile update error response:', errorData);
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          console.error('Error parsing profile update error:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      console.log('Profile updated successfully:', responseData);
      setSuccess('Profile updated successfully!');
      
      // Reset the profile image file state
      setProfileImageFile(null);
      setEditMode(false);
      fetchProfile(); // Refresh profile data
      fetchUserRating(); // Refresh rating in case user data changed
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const onCancelClicked = () => {
    setEditMode(false);
    setProfile(newProfile);
  }
  
  const handleChangePicture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="profile-container">
      <h1 className="profile-title">Profile</h1>
      <div className="profile-card">
        <div className="profile-header">
          <div className={`profile-picture-preview ${!editMode ? 'clickable' : ''}`} onClick={() => !editMode && setEditMode(true)}>
            <img
              src={profile.profile_picture || '/default-avatar.svg'}
              alt="Profile"
              className="profile-preview-image"
            />
            {editMode && (
              <>
                {profile.profile_picture && (
                  <button 
                    type="button" 
                    className="remove-profile-picture" 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProfilePicture();
                    }}
                    title="Remove picture"
                  >
                    <img src="/remove.svg" alt="Remove" />
                  </button>
                )}
              </>
            )}
            {!editMode ? (
              <div className="edit-overlay">
                <span className="edit-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </span>
              </div>
            ) : (
              <div className="change-picture-button" onClick={(e) => {
                e.stopPropagation();
                handleChangePicture();
              }}>
                Change picture
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            id="profile_picture"
            name="profile_picture"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleProfilePictureChange}
            style={{ display: 'none' }}
          />
          <h2>
            {profile.first_name} {profile.last_name}
          </h2>
          <p>{profile.phone_number}</p>
          
          {/* User Rating Display */}
          {averageRating !== null ? (
            <div className="user-rating">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`star ${star <= Math.round(averageRating) ? 'filled' : ''}`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <div className="rating-info">
                <span className="rating-score">{averageRating}/5</span>
                <span className="rating-count">({totalReviews} review{totalReviews !== 1 ? 's' : ''})</span>
              </div>
            </div>
          ) : (
            <div className="user-rating">
              <span className="no-rating">No reviews yet</span>
            </div>
          )}
        </div>
        <div className="profile-general-view-radio-container">
          <label className="profile-general-view-radio-item">
            <input
              type="radio"
              name="radio"
              checked={profileViewRadioValue === PROFILE_VIEWING_TYPE.DETAILS}
              onChange={() => setProfileViewRadioValue(PROFILE_VIEWING_TYPE.DETAILS)}
            />
            <span className="name">Details</span>
          </label>
          <label className="profile-general-view-radio-item">
            <input
              type="radio"
              name="radio"
              checked={profileViewRadioValue === PROFILE_VIEWING_TYPE.SECURITY}
              onChange={() => setProfileViewRadioValue(PROFILE_VIEWING_TYPE.SECURITY)}
            />
            <span className="name">Security</span>
          </label>
        </div>

        {profileViewRadioValue === PROFILE_VIEWING_TYPE.DETAILS ? (
          <div className="profile-section">
            {loading && <p className="feedback">Loading...</p>}
            <div aria-live="polite">
              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
            </div>

            <form className="profile-form" onSubmit={handleSubmit}>
              <label className='profile-form-label'>
                First Name
                <input
                  id="first_name"
                  name="first_name"
                  value={profile.first_name}
                  onChange={handleChange}
                  disabled={!editMode}
                  required
                />
              </label>

              <label className='profile-form-label'>
                Last Name
                <input
                  id="last_name"
                  name="last_name"
                  value={profile.last_name}
                  onChange={handleChange}
                  disabled={!editMode}
                  required
                />
              </label>

              <label className='profile-form-label'>
                Phone Number
                <input
                  id="phone_number"
                  name="phone_number"
                  value={profile.phone_number}
                  onChange={handleChange}
                  disabled={!editMode}
                />
              </label>

              <label className='profile-form-label'>
                Bio
                <textarea
                  id="bio"
                  name="bio"
                  value={profile.bio}
                  onChange={handleChange}
                  disabled={!editMode}
                />
              </label>

              <div className={`action-buttons ${editMode ? 'edit-mode' : ''}`}>
                {editMode && (
                  <>
                    <Button type="submit" disabled={loading} className='save-button'>
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancelClicked}
                      className='cancel-button'
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {!editMode && (
                  <button
                    type="button"
                    className="profile-edit-button"
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </form>
          </div>
        ) :
          <div className="profile-section">
            <TwoFASettings user={profile} onTwoFAStatusChange={fetchProfile} />
          </div>
        }

        {/* Security Settings Section */}
      </div>
    </div>
  );
};

export default ProfilePage;
