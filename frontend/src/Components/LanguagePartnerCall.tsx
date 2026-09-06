import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone,
  X
} from 'lucide-react';
import type { LanguagePreferences } from './LanguagePartner';
import { createWebRTCManager, type WebRTCManager } from '../utils/webrtc';

const LanguagePartnerCall: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcManager = useRef<WebRTCManager | null>(null);
  
  // Get preferences from navigation state
  const preferences = location.state?.preferences as LanguagePreferences;
  const roomId = location.state?.roomId || `room_${Date.now()}`;
  
  // Call controls state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);
  
  // Partner info
  const [partnerInfo, setPartnerInfo] = useState({
    name: 'Language Partner',
    country: '🌍',
    language: preferences?.mode === 'teach' ? 'Student' : 'Teacher'
  });

  useEffect(() => {
    const initializeWebRTC = async () => {
      if (localVideoRef.current && remoteVideoRef.current) {
        try {
          webrtcManager.current = createWebRTCManager();
          
          // Initialize WebRTC connection
          await webrtcManager.current.initialize(
            localVideoRef.current,
            remoteVideoRef.current,
            roomId
          );

          // Handle remote stream
          webrtcManager.current.onRemoteStream(() => {
            console.log('Remote stream received');
            setConnectionStatus('connected');
            setRemoteVideoAvailable(true);
          });

          // Handle call ending
          webrtcManager.current.onCallEnded(() => {
            setConnectionStatus('disconnected');
            setTimeout(() => {
              navigate('/language-partner', { state: { preferences } });
            }, 1000);
          });

        } catch (error) {
          console.error('Failed to initialize WebRTC:', error);
          
          // Show a simple error message
          alert('There was an issue accessing your camera. Please check your browser permissions and try again.');
          
          // Navigate back after a short delay
          setTimeout(() => {
            navigate('/language-partner', { state: { preferences } });
          }, 3000);
        }
      }
    };

    initializeWebRTC();

    // Cleanup on unmount
    return () => {
      if (webrtcManager.current) {
        webrtcManager.current.endCall();
      }
    };
  }, [preferences, roomId, navigate]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (webrtcManager.current) {
      webrtcManager.current.toggleAudio();
    }
  };

  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
    if (webrtcManager.current) {
      webrtcManager.current.toggleVideo();
    }
  };

  const endCall = () => {
    // Clean up WebRTC connection
    if (webrtcManager.current) {
      webrtcManager.current.endCall();
    }
    
    // Navigate back to language partner selection with previous preferences
    navigate('/language-partner', { state: { preferences } });
  };

  if (!preferences) {
    // Redirect if no preferences (direct access)
    navigate('/language-partner');
    return null;
  }

  return (
    <div className="h-screen w-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Status Bar */}
      <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{preferences.mode === 'teach' ? 'Teaching' : 'Learning'}: {preferences.targetLanguage}</span>
          <span className="text-xs text-gray-300">({partnerInfo.language})</span>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connecting' && (
            <div className="flex items-center">
              <div className="animate-pulse bg-yellow-500 h-2 w-2 rounded-full mr-2"></div>
              <span className="text-xs">Connecting...</span>
            </div>
          )}
          {connectionStatus === 'connected' && (
            <div className="flex items-center">
              <div className="bg-green-500 h-2 w-2 rounded-full mr-2"></div>
              <span className="text-xs">Connected</span>
            </div>
          )}
          {connectionStatus === 'disconnected' && (
            <div className="flex items-center">
              <div className="bg-red-500 h-2 w-2 rounded-full mr-2"></div>
              <span className="text-xs">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Side - Local Video */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-800 relative">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <VideoOff className="h-12 w-12 text-gray-400" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            <span>You</span>
          </div>
        </div>

        {/* Right Side - Remote Video */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-800 relative">
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
          
          {/* Connection status overlay */}
          {!remoteVideoAvailable && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-80">
              <div className="text-center p-4">
                {connectionStatus === 'connecting' ? (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white text-lg font-medium">Connecting to partner...</p>
                    <p className="text-gray-300 text-sm mt-2">This may take a moment</p>
                  </>
                ) : connectionStatus === 'disconnected' ? (
                  <>
                    <div className="rounded-full h-12 w-12 border-2 border-red-500 flex items-center justify-center mx-auto mb-4">
                      <X className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-white text-lg font-medium">Connection lost</p>
                    <p className="text-gray-300 text-sm mt-2">Returning to partner selection...</p>
                  </>
                ) : (
                  <>
                    <div className="animate-pulse rounded-full h-12 w-12 border-2 border-yellow-500 mx-auto mb-4 flex items-center justify-center">
                      <Video className="h-6 w-6 text-yellow-500" />
                    </div>
                    <p className="text-white text-lg font-medium">Waiting for partner's video...</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Partner Info Overlay */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg">
            <div className="flex items-center gap-2">
              <span>{partnerInfo.country}</span>
              <span className="font-medium">{partnerInfo.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Call Controls - Perfectly Centered */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center items-center z-20">
        <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-full px-6 py-4 flex items-center gap-6 shadow-lg border border-gray-700">
          <Button
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            onClick={toggleMute}
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16"
          >
            {isMuted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
          </Button>
          
          <Button
            size="lg"
            variant={!isVideoOn ? "destructive" : "secondary"}
            onClick={toggleVideo}
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16"
          >
            {isVideoOn ? <Video className="h-6 w-6 sm:h-7 sm:w-7" /> : <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" />}
          </Button>
          
          <Button
            size="lg"
            variant="destructive"
            onClick={endCall}
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-red-600 hover:bg-red-700"
          >
            <Phone className="h-6 w-6 sm:h-7 sm:w-7 transform rotate-135" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LanguagePartnerCall;