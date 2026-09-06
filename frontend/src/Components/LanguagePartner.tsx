import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { createWebRTCManager } from '../utils/webrtc';
import { Languages, GraduationCap, BookOpen, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../../config';

export interface LanguagePreferences {
  mode: 'teach' | 'learn';
  targetLanguage: string;
  instructionLanguage: string;
}

const LANGUAGES = [
  'English', 'German', 'Spanish', 'French', 'Italian', 'Portuguese', 
  'Dutch', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Russian',
  'Hindi', 'Turkish', 'Polish', 'Swedish', 'Norwegian', 'Danish'
];

const LanguagePartner: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'mode' | 'preferences' | 'matching'>('mode');
  const [preferences, setPreferences] = useState<LanguagePreferences>({
    mode: 'learn',
    targetLanguage: '',
    instructionLanguage: ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [webrtcManager, setWebrtcManager] = useState<any>(null);

  const handleModeSelect = (mode: 'teach' | 'learn') => {
    setPreferences({ ...preferences, mode });
    setStep('preferences');
  };

  const handlePreferencesSubmit = () => {
    if (!preferences.targetLanguage || !preferences.instructionLanguage) {
      alert('Please select both languages');
      return;
    }
    setStep('matching');
    startPartnerSearch();
  };

  const startPartnerSearch = async () => {
    // Prevent multiple connections
    if (isSearching) {
      console.log('Search already in progress, ignoring request');
      return;
    }
    
    // Clean up any existing connection
    if (webrtcManager && webrtcManager.websocket) {
      console.log('Closing existing WebSocket connection');
      try {
        webrtcManager.websocket.close(1000, "User initiated new search");
      } catch (error) {
        console.error('Error closing existing WebSocket:', error);
      }
      setWebrtcManager(null);
    }
    
    setIsSearching(true);
    
    try {
      // Create WebSocket connection directly for partner matching
      // Use a unique ID with timestamp to avoid conflicts
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000); // Add randomness
      const userId = `user_${timestamp}${randomId}`;
      const wsUrl = API_BASE_URL.replace('http', 'ws') + `/ws/language-partner/${userId}`;
      console.log('Connecting to WebSocket:', wsUrl);
      console.log('User preferences:', preferences);
      
      const websocket = new WebSocket(wsUrl);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (websocket && websocket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout');
          try {
            websocket.close(1000, "Connection timeout");
          } catch (error) {
            console.error('Error closing WebSocket on timeout:', error);
          }
          setIsSearching(false);
          alert('Connection timeout. Please try again.');
          setStep('preferences');
        }
      }, 10000); // 10 second timeout
      
      websocket.onopen = () => {
        console.log('WebSocket connected for partner matching');
        console.log('WebSocket readyState:', websocket.readyState);
        clearTimeout(connectionTimeout);
        
        // Send find_partner message immediately
        const message = {
          type: 'find_partner',
          data: {
            preferences,
            user_id: userId
          }
        };
        console.log('Sending find_partner message:', message);
        
        try {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(message));
            console.log('Message sent successfully');
          } else {
            console.error('WebSocket not open when trying to send message. ReadyState:', websocket.readyState);
            setIsSearching(false);
            alert('Connection error. Please try again.');
            setStep('preferences');
          }
        } catch (error) {
          console.error('Error sending find_partner message:', error);
          setIsSearching(false);
          alert('Connection error. Please try again.');
          setStep('preferences');
        }
      };
      
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Partner matching message:', message);
          
          if (message.type === 'match_found') {
            console.log('Partner found!', message.data);
            clearTimeout(connectionTimeout);
            // Close the matching WebSocket and navigate to call page
            try {
              websocket.close(1000, "Match found, navigating to call page");
            } catch (error) {
              console.error('Error closing WebSocket after match found:', error);
            }
            navigate('/language-partner/call', { 
              state: { 
                preferences, 
                roomId: message.data.room_id
              } 
            });
          } else if (message.type === 'waiting_for_partner') {
            console.log('Waiting for partner...');
            // Continue waiting
          } else if (message.type === 'error') {
            console.error('Server error:', message.message);
            clearTimeout(connectionTimeout);
            setIsSearching(false);
            alert('Server error: ' + message.message);
            setStep('preferences');
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          clearTimeout(connectionTimeout);
          setIsSearching(false);
          alert('Error processing server message. Please try again.');
          setStep('preferences');
        }
      };
      
      websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        console.log('Clean close:', event.wasClean);
        clearTimeout(connectionTimeout);
        
        // Only show an error if this wasn't a normal close and we're still searching
        if (event.code !== 1000 && isSearching) {
          console.log('Unexpected WebSocket close, resetting state');
          setIsSearching(false);
          
          // Only show alert if it wasn't a normal navigation
          if (document.visibilityState === 'visible') {
            alert('Connection to matching service was lost. Please try again.');
          }
          
          setStep('preferences');
        }
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket readyState:', websocket.readyState);
        console.error('WebSocket URL:', wsUrl);
        console.error('Error event:', error);
        clearTimeout(connectionTimeout);
        setIsSearching(false);
        
        // Only show alert if the page is visible
        if (document.visibilityState === 'visible') {
          alert('Failed to connect to matching service. Please try again.');
        }
        
        setStep('preferences');
      };
      
      // Store websocket for cleanup
      setWebrtcManager({ websocket });
      
    } catch (error) {
      console.error('Error starting partner search:', error);
      setIsSearching(false);
      alert('Failed to start partner search. Please try again.');
      setStep('preferences');
    }
  };

  const goBack = () => {
    if (step === 'preferences') {
      setStep('mode');
    } else if (step === 'matching') {
      // Clean up WebSocket connection if going back
      if (webrtcManager && webrtcManager.websocket) {
        webrtcManager.websocket.close();
        setWebrtcManager(null);
      }
      setStep('preferences');
      setIsSearching(false);
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (webrtcManager && webrtcManager.websocket) {
        webrtcManager.websocket.close();
      }
    };
  }, [webrtcManager]);

  if (step === 'mode') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 px-4 lg:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 lg:mb-12">
            <div className="flex items-center justify-center mb-4">
              <Languages className="h-8 w-8 lg:h-12 lg:w-12 text-indigo-600 mr-2 lg:mr-3" />
              <h1 className="text-2xl lg:text-4xl font-bold text-gray-900">Language Partner</h1>
            </div>
            <p className="text-lg lg:text-xl text-gray-600">Connect with language learners worldwide</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-2xl mx-auto">
            <Card 
              className="p-6 lg:p-8 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-indigo-300"
              onClick={() => handleModeSelect('teach')}
            >
              <div className="text-center">
                <GraduationCap className="h-12 w-12 lg:h-16 lg:w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4">I want to teach</h2>
                <p className="text-sm lg:text-base text-gray-600 mb-6">
                  Share your language skills and help others learn. Connect with eager students 
                  from around the world.
                </p>
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Start Teaching <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>

            <Card 
              className="p-6 lg:p-8 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-indigo-300"
              onClick={() => handleModeSelect('learn')}
            >
              <div className="text-center">
                <BookOpen className="h-12 w-12 lg:h-16 lg:w-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4">I want to learn</h2>
                <p className="text-sm lg:text-base text-gray-600 mb-6">
                  Practice with native speakers and improve your language skills through 
                  real conversations.
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Learning <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preferences') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 px-4 lg:py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Language Preferences</h1>
            <p className="text-sm lg:text-base text-gray-600">
              {preferences.mode === 'teach' 
                ? 'Which language would you like to teach?' 
                : 'Which language would you like to learn?'
              }
            </p>
          </div>

          <Card className="p-6 lg:p-8">
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium mb-4 block">
                  {preferences.mode === 'teach' ? 'Language I can teach:' : 'Language I want to learn:'}
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3">
                  {LANGUAGES.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, targetLanguage: language })}
                      className={`p-2 lg:p-3 text-xs lg:text-sm rounded-lg border-2 transition-colors ${
                        preferences.targetLanguage === language
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-lg font-medium mb-4 block">
                  Instruction language (for communication):
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3">
                  {LANGUAGES.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, instructionLanguage: language })}
                      className={`p-2 lg:p-3 text-xs lg:text-sm rounded-lg border-2 transition-colors ${
                        preferences.instructionLanguage === language
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  variant="outline"
                  onClick={goBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handlePreferencesSubmit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={!preferences.targetLanguage || !preferences.instructionLanguage}
                >
                  Find Partner
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'matching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 px-4 lg:py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 lg:p-12 text-center">
            <div className="animate-spin h-12 w-12 lg:h-16 lg:w-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-6"></div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4">Finding your perfect language partner...</h2>
            <p className="text-sm lg:text-base text-gray-600 mb-2">
              Looking for someone who {preferences.mode === 'teach' ? 'wants to learn' : 'can teach'} {preferences.targetLanguage}
            </p>
            <p className="text-xs lg:text-sm text-gray-500 mb-6 lg:mb-8">
              Communication language: {preferences.instructionLanguage}
            </p>
            
            <div className="flex flex-col gap-4">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Searching for partners...</span>
                  <span>🔍</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={goBack}
                className="mt-4"
              >
                Change Preferences
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default LanguagePartner;