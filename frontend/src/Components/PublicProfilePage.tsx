import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Star, User, Calendar, Shield, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import '../Style/pages/public-profile-page.scss';
import { API_BASE_URL } from '../../config';

interface PublicUserProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  bio: string | null;
  registration_date: string;
  account_status: string;
  verification_status: boolean;
  trust_score: string;
  listings_count: number;
  average_rating: number | null;
  total_reviews: number;
  positive_reviews: number;
  neutral_reviews: number;
  negative_reviews: number;
}

const PublicProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/users/public/${userId}/guest`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('User profile not found');
          } else {
            setError('Failed to load profile');
          }
          return;
        }
        
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setError('Failed to load profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-blue-600';
    if (rating >= 3.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrustScoreColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 4.5) return 'text-green-600';
    if (numScore >= 4.0) return 'text-blue-600';
    if (numScore >= 3.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="message">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="error-state">
        <div className="error-content">
          <XCircle className="error-icon" />
          <h2 className="title">Profile Not Found</h2>
          <p className="message">{error || 'This user profile is not available'}</p>
          <Button 
            onClick={() => navigate(-1)}
            className="back-button"
          >
            <ArrowLeft className="back-icon" />
            <span>Go Back</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="public-profile-page">
      <div className="profile-container">
        {/* Updated Back Button with Icon */}
        <div className="header-with-back-button">
          <Button 
            onClick={() => navigate(-1)}
            variant="outline"
            className="back-button"
          >
            <ArrowLeft className="back-icon" />
            <span>Back</span>
          </Button>
          <h1 className="page-title">User Profile</h1>
        </div>

        <div className="profile-grid">
          {/* Main Profile Card */}
          <div className="main-profile-card">
            <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="pb-6">
                <div className="flex items-start space-x-6">
                  {/* Profile Picture */}
                  <div className="flex-shrink-0">
                    {profile.profile_picture ? (
                      <img
                        src={profile.profile_picture}
                        alt={`${profile.first_name} ${profile.last_name}`}
                        className="w-24 h-24 rounded-full object-cover border-4 border-[#3cb371]/20"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#3cb371] to-[#2d8f5a] flex items-center justify-center">
                        <User className="w-12 h-12 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h2 className="text-2xl font-bold text-gray-800">
                        {profile.first_name} {profile.last_name}
                      </h2>
                      {profile.verification_status && (
                        <CheckCircle className="w-6 h-6 text-green-500" aria-label="Verified User" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {formatDate(profile.registration_date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Shield className="w-4 h-4" />
                        <span className={getTrustScoreColor(profile.trust_score)}>
                          Trust Score: {profile.trust_score}
                        </span>
                      </div>
                    </div>

                    {profile.bio && (
                      <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Rating Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-yellow-500" />
                    Rating & Reviews
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Average Rating */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Average Rating</span>
                        {profile.average_rating ? (
                          <span className={`text-2xl font-bold ${getRatingColor(profile.average_rating)}`}>
                            {profile.average_rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-2xl font-bold text-gray-400">N/A</span>
                        )}
                      </div>
                      {profile.average_rating && (
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= Math.round(profile.average_rating!)
                                  ? 'text-yellow-500 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Review Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <span className="text-sm text-gray-600 mb-3 block">Review Breakdown</span>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600">Positive (4-5★)</span>
                          <span className="font-medium">{profile.positive_reviews}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-yellow-600">Neutral (3-4★)</span>
                          <span className="font-medium">{profile.neutral_reviews}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Negative (1-3★)</span>
                          <span className="font-medium">{profile.negative_reviews}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>Total Reviews</span>
                            <span>{profile.total_reviews}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">{profile.listings_count}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Active Listings</p>
                          <p className="text-sm text-gray-600">Currently selling</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Clock className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Account Status</p>
                          <p className="text-sm text-gray-600 capitalize">{profile.account_status.toLowerCase()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-800">Quick Stats</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Member Since</span>
                  <span className="font-medium">{formatDate(profile.registration_date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Trust Score</span>
                  <span className={`font-medium ${getTrustScoreColor(profile.trust_score)}`}>
                    {profile.trust_score}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Reviews</span>
                  <span className="font-medium">{profile.total_reviews}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Listings</span>
                  <span className="font-medium">{profile.listings_count}</span>
                </div>
              </CardContent>
            </Card>

            {/* Contact Actions Card - Replace View Listings with Back to Listings */}
            <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-800">Actions</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full bg-[#3cb371] hover:bg-[#2d8f5a] text-white"
                  onClick={() => {
                    navigate('/messages', { 
                      state: { 
                        newConversationWith: {
                          userId: profile.user_id,
                          firstName: profile.first_name,
                          lastName: profile.last_name
                        }
                      }
                    });
                  }}
                >
                  Send Message
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-[#3cb371] text-[#3cb371] hover:bg-[#3cb371] hover:text-white"
                  onClick={() => navigate('/app')}
                >
                  Back to Listings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePage; 