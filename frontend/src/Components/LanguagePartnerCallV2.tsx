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

const LanguagePartnerCallV2: React.FC = () => {
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
          
          // Join existing room instead of starting new partner search
          console.log('Joining existing room:', roomId);
          
          // Set up callbacks before joining room
          // Handle remote stream
          webrtcManager.current.onRemoteStream((stream) => {
            console.log('Remote stream received');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
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

          // Handle partner matching
          webrtcManager.current.onPartnerMatched((data) => {
            setPartnerInfo({
              name: data.partner_name || 'Language Partner',
              country: data.partner_country || '🌍',
              language: preferences?.mode === 'teach' ? 'Student' : 'Teacher'
            });
          });

          // Create new WebSocket connection for the call
          console.log('Creating new WebSocket connection for call');
          await webrtcManager.current.joinRoom(
            localVideoRef.current,
            remoteVideoRef.current,
            roomId
          );

        } catch (error) {
          console.error('Failed to initialize WebRTC:', error);
          // Fallback to basic media access
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          } catch (mediaError) {
            console.error('Error accessing media devices:', mediaError);
          }
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
    <div className="h-screen bg-gray-900 flex flex-col relative overflow-hidden">
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

      {/* Main Video Area */}
      <div className="flex-1 relative">
        {/* Side-by-Side Video Layout */}
        <div className="h-full flex flex-col md:flex-row">
          {/* Left side - Local Video */}
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
                <VideoOff className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-black bg-opacity-60 text-white px-2 sm:px-3 py-1 rounded-lg text-sm">
              You {isMuted && '🔇'}
            </div>
          </div>
          
          {/* Right side - Remote Video */}
          <div className="w-full md:w-1/2 h-1/2 md:h-full bg-gray-800 relative">
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23374151'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='%23E5E7EB' text-anchor='middle' dy='.3em'%3EWaiting for partner...%3C/text%3E%3C/svg%3E"
            />
            
            {/* Partner Info Overlay */}
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black bg-opacity-60 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-sm sm:text-base">{partnerInfo.country}</span>
                <span className="font-medium text-sm sm:text-base">{partnerInfo.name}</span>
                <span className="text-xs sm:text-sm text-gray-300 hidden sm:inline">({partnerInfo.language})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Call Controls - Perfectly Centered */}
        <div className="fixed bottom-10 left-0 right-0 flex justify-center items-center z-30">
          <div className="bg-gray-800 backdrop-blur-sm rounded-full px-6 py-4 flex items-center gap-6 shadow-2xl border border-gray-600">
            <Button
              size="lg"
              variant={isMuted ? "destructive" : "secondary"}
              onClick={toggleMute}
              className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-gray-700 hover:bg-gray-600 border-0"
            >
              {isMuted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
            </Button>
            
            <Button
              size="lg"
              variant={!isVideoOn ? "destructive" : "secondary"}
              onClick={toggleVideo}
              className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-gray-700 hover:bg-gray-600 border-0"
            >
              {isVideoOn ? <Video className="h-6 w-6 sm:h-7 sm:w-7" /> : <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" />}
            </Button>
            
            <Button
              size="lg"
              variant="destructive"
              onClick={endCall}
              className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-red-600 hover:bg-red-700 border-0"
            >
              <Phone className="h-6 w-6 sm:h-7 sm:w-7 transform rotate-135" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguagePartnerCallV2;