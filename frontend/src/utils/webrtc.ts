import { API_BASE_URL } from '../../config';

export interface WebRTCManager {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  websocket: WebSocket | null;
  initialize: (localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, preferences: any) => Promise<void>;
  joinRoom: (localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, roomId: string) => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endCall: () => void;
  sendMessage: (message: string) => void;
  onMessage: (callback: (message: any) => void) => void;
  onRemoteStream: (callback: (stream: MediaStream) => void) => void;
  onCallEnded: (callback: () => void) => void;
  onPartnerMatched: (callback: (data: any) => void) => void;
}

export const createWebRTCManager = (): WebRTCManager => {
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let websocket: WebSocket | null = null;
  let currentRoomId: string | null = null;
  // Store ICE candidates that arrive before remote description is set
  const pendingIceCandidates: RTCIceCandidateInit[] = [];

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const initialize = async (localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, preferences: any): Promise<void> => {
    try {
      // Generate a unique user ID with timestamp and random number
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000);
      const userId = `user_${timestamp}${randomId}`;
      
      // Connect to WebSocket server
      const wsUrl = API_BASE_URL.replace('http', 'ws') + `/ws/language-partner/${userId}`;
      console.log('Initializing WebRTC with WebSocket URL:', wsUrl);
      
      // Close any existing connection
      if (websocket) {
        try {
          websocket.close(1000, "Creating new connection");
        } catch (error) {
          console.error('Error closing existing WebSocket:', error);
        }
      }
      
      websocket = new WebSocket(wsUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (websocket && websocket.readyState === WebSocket.CONNECTING) {
          console.error('WebSocket connection timeout');
          try {
            websocket.close(1000, "Connection timeout");
          } catch (error) {
            console.error('Error closing WebSocket on timeout:', error);
          }
          throw new Error('WebSocket connection timeout');
        }
      }, 10000);
      
      // Get user media with a longer timeout
      try {
        // Set a longer timeout for getUserMedia (30 seconds)
        const getUserMediaWithTimeout = async () => {
          return new Promise<MediaStream>((resolve, reject) => {
            // Set a longer timeout for getUserMedia (30 seconds)
            const timeout = setTimeout(() => {
              console.warn('Media access is taking longer than expected, still trying...');
            }, 5000);
            
            // Set a final timeout (60 seconds)
            const finalTimeout = setTimeout(() => {
              reject(new Error('Timeout accessing media devices after 60 seconds'));
            }, 60000);
            
            navigator.mediaDevices.getUserMedia({
              video: { width: 1280, height: 720 },
              audio: { echoCancellation: true, noiseSuppression: true }
            }).then(stream => {
              clearTimeout(timeout);
              clearTimeout(finalTimeout);
              resolve(stream);
            }).catch(error => {
              clearTimeout(timeout);
              clearTimeout(finalTimeout);
              reject(error);
            });
          });
        };
        
        localStream = await getUserMediaWithTimeout();
        
        localVideo.srcObject = localStream;
        console.log('Local media stream obtained successfully');
      } catch (mediaError) {
        console.error('Error accessing media devices:', mediaError);
        clearTimeout(connectionTimeout);
        throw mediaError;
      }

      // Create peer connection
      peerConnection = new RTCPeerConnection(configuration);
      console.log('RTCPeerConnection created');

      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, localStream!);
      });
      console.log('Local tracks added to peer connection');

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Remote track received:', event.track.kind);
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        remoteStreamCallbacks.forEach(callback => callback(remoteStream!));
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && websocket && websocket.readyState === WebSocket.OPEN) {
          try {
            websocket.send(JSON.stringify({
              type: 'webrtc_ice_candidate',
              data: {
                candidate: event.candidate
              }
            }));
            console.log('ICE candidate sent');
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };
      
      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state changed to:', peerConnection?.iceConnectionState);
        if (peerConnection?.iceConnectionState === 'failed' || 
            peerConnection?.iceConnectionState === 'disconnected') {
          console.error('ICE connection failed or disconnected');
          callEndedCallbacks.forEach(callback => callback());
        }
      };
      
      // Handle signaling state changes
      peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state changed to:', peerConnection?.signalingState);
      };

      // Set up WebSocket message handling
      websocket.onopen = () => {
        console.log('WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        
        // Find partner with preferences
        try {
          websocket!.send(JSON.stringify({
            type: 'find_partner',
            data: {
              preferences,
              user_id: userId
            }
          }));
          console.log('find_partner message sent');
        } catch (error) {
          console.error('Error sending find_partner message:', error);
        }
      };

      websocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type);
          await handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        
        if (event.code !== 1000) {
          console.error('WebSocket closed abnormally');
          callEndedCallbacks.forEach(callback => callback());
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        callEndedCallbacks.forEach(callback => callback());
      };

    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      throw error;
    }
  };

  const joinRoom = async (localVideo: HTMLVideoElement, remoteVideo: HTMLVideoElement, roomId: string): Promise<void> => {
    try {
      console.log('Starting joinRoom with roomId:', roomId);
      
      // Generate a unique user ID with timestamp and random number
      const timestamp = Date.now();
      const randomId = Math.floor(Math.random() * 10000);
      const userId = `user_${timestamp}${randomId}`;
      
      // Close any existing connection
      if (websocket) {
        try {
          websocket.close(1000, "Creating new connection for room join");
        } catch (error) {
          console.error('Error closing existing WebSocket:', error);
        }
      }
      
      // Set connection timeout
      let connectionTimeout: ReturnType<typeof setTimeout>;
      
      // Get user media with a longer timeout
      try {
        // Set a longer timeout for getUserMedia (30 seconds)
        const getUserMediaWithTimeout = async () => {
          return new Promise<MediaStream>((resolve, reject) => {
            // Set a longer timeout for getUserMedia (30 seconds)
            const timeout = setTimeout(() => {
              console.warn('Media access is taking longer than expected in joinRoom, still trying...');
            }, 5000);
            
            // Set a final timeout (60 seconds)
            const finalTimeout = setTimeout(() => {
              reject(new Error('Timeout accessing media devices in joinRoom after 60 seconds'));
            }, 60000);
            
            navigator.mediaDevices.getUserMedia({
              video: { width: 1280, height: 720 },
              audio: { echoCancellation: true, noiseSuppression: true }
            }).then(stream => {
              clearTimeout(timeout);
              clearTimeout(finalTimeout);
              resolve(stream);
            }).catch(error => {
              clearTimeout(timeout);
              clearTimeout(finalTimeout);
              reject(error);
            });
          });
        };
        
        localStream = await getUserMediaWithTimeout();
        
        localVideo.srcObject = localStream;
        console.log('Local media stream obtained successfully in joinRoom');
      } catch (mediaError) {
        console.error('Error accessing media devices in joinRoom:', mediaError);
        throw mediaError;
      }

      // Create peer connection
      peerConnection = new RTCPeerConnection(configuration);
      console.log('RTCPeerConnection created');

      // Add local stream to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, localStream!);
      });
      console.log('Local tracks added to peer connection');

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream:', event.track.kind);
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        remoteStreamCallbacks.forEach(callback => callback(remoteStream!));
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && websocket && websocket.readyState === WebSocket.OPEN) {
          try {
            console.log('Sending ICE candidate');
            websocket.send(JSON.stringify({
              type: 'webrtc_ice_candidate',
              data: {
                candidate: event.candidate
              }
            }));
          } catch (error) {
            console.error('Error sending ICE candidate:', error);
          }
        }
      };
      
      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state changed to:', peerConnection?.iceConnectionState);
        if (peerConnection?.iceConnectionState === 'failed' || 
            peerConnection?.iceConnectionState === 'disconnected') {
          console.error('ICE connection failed or disconnected');
          callEndedCallbacks.forEach(callback => callback());
        }
      };
      
      // Handle signaling state changes
      peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state changed to:', peerConnection?.signalingState);
      };

      // Now establish WebSocket connection for signaling
      const wsUrl = API_BASE_URL.replace('http', 'ws') + `/ws/language-partner/${userId}`;
      console.log('Connecting to WebSocket for call:', wsUrl);
      console.log('Room ID to join:', roomId);
      
      websocket = new WebSocket(wsUrl);
      currentRoomId = roomId;
      
      // Set connection timeout
      connectionTimeout = setTimeout(() => {
        if (websocket && websocket.readyState === WebSocket.CONNECTING) {
          console.error('WebSocket connection timeout in joinRoom');
          try {
            websocket.close(1000, "Connection timeout");
          } catch (error) {
            console.error('Error closing WebSocket on timeout:', error);
          }
          callEndedCallbacks.forEach(callback => callback());
        }
      }, 10000);

      // Set up WebSocket message handling
      websocket.onopen = () => {
        console.log('WebSocket connected to existing room:', roomId);
        console.log('WebSocket readyState:', websocket?.readyState);
        clearTimeout(connectionTimeout);
        
        // Send join_room message immediately
        const joinMessage = {
          type: 'join_room',
          data: {
            room_id: roomId,
            user_id: userId
          }
        };
        console.log('Sending join_room message:', joinMessage);
        
        try {
          websocket!.send(JSON.stringify(joinMessage));
          console.log('join_room message sent successfully');
        } catch (error) {
          console.error('Error sending join_room message:', error);
          callEndedCallbacks.forEach(callback => callback());
        }
      };

      websocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received in room:', message.type);
          await handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error handling WebSocket message in room:', error);
        }
      };

      websocket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason, 'Clean:', event.wasClean);
        clearTimeout(connectionTimeout);
        
        if (event.code !== 1000) {
          console.error('WebSocket connection closed abnormally - possible network or server issue');
          callEndedCallbacks.forEach(callback => callback());
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error in joinRoom:', error);
        console.error('WebSocket readyState:', websocket?.readyState);
        console.error('WebSocket URL:', wsUrl);
        console.error('Room ID:', roomId);
        clearTimeout(connectionTimeout);
        callEndedCallbacks.forEach(callback => callback());
      };

     } catch (error) {
       console.error('Error joining room:', error);
       throw error;
     }
   };



  const handleWebSocketMessage = async (message: any) => {
    switch (message.type) {
      case 'match_found':
        console.log('Partner found!', message.data);
        currentRoomId = message.data.room_id;
        partnerMatchedCallbacks.forEach(callback => callback(message.data));
        
        // Don't automatically start WebRTC offer process here
        // Let the ready_for_webrtc message trigger the offer
        break;

      case 'waiting_for_partner':
        console.log('Waiting for partner:', message.data);
        break;

      case 'room_joined':
        console.log('Successfully joined room:', message.data);
        currentRoomId = message.data.room_id;
        // Notify that we're in the room
        partnerMatchedCallbacks.forEach(callback => callback({
          room_id: message.data.room_id,
          message: message.data.message,
          user_count: message.data.user_count
        }));
        break;

      case 'ready_for_webrtc':
        console.log('Ready for WebRTC, starting offer:', message.data);
        // Both users are in room, start WebRTC offer
        // Only the first user in the room should create the offer
        if (peerConnection && message.data.should_create_offer) {
          try {
            console.log('Creating WebRTC offer as initiator');
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            websocket!.send(JSON.stringify({
              type: 'webrtc_offer',
              data: { offer }
            }));
          } catch (error) {
            console.error('Error creating WebRTC offer:', error);
          }
        } else {
          console.log('Waiting for WebRTC offer from initiator');
        }
        break;

      case 'webrtc_offer':
        console.log('Received WebRTC offer');
        if (peerConnection && message.data.offer) {
          try {
            // Check if we're in a valid state to receive an offer
            if (peerConnection.signalingState === 'stable') {
              console.log('Setting remote description from offer');
              await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.offer));
              
              // Process any pending ICE candidates now that we have a remote description
              if (pendingIceCandidates.length > 0) {
                console.log(`Processing ${pendingIceCandidates.length} pending ICE candidates`);
                for (const candidate of pendingIceCandidates) {
                  try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (error) {
                    console.error('Error adding pending ICE candidate:', error);
                  }
                }
                // Clear the pending candidates
                pendingIceCandidates.length = 0;
              }
              
              console.log('Creating answer');
              const answer = await peerConnection.createAnswer();
              console.log('Setting local description for answer');
              await peerConnection.setLocalDescription(answer);
              console.log('Sending answer');
              websocket!.send(JSON.stringify({
                type: 'webrtc_answer',
                data: { answer }
              }));
            } else {
              console.error('Cannot process offer: signaling state is', peerConnection.signalingState);
            }
          } catch (error) {
            console.error('Error handling WebRTC offer:', error);
          }
        }
        break;

      case 'webrtc_answer':
        console.log('Received WebRTC answer');
        if (peerConnection && message.data.answer) {
          try {
            // Check if we're in a valid state to receive an answer
            if (peerConnection.signalingState === 'have-local-offer') {
              console.log('Setting remote description from answer');
              await peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.answer));
              
              // Process any pending ICE candidates now that we have a remote description
              if (pendingIceCandidates.length > 0) {
                console.log(`Processing ${pendingIceCandidates.length} pending ICE candidates after answer`);
                for (const candidate of pendingIceCandidates) {
                  try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (error) {
                    console.error('Error adding pending ICE candidate after answer:', error);
                  }
                }
                // Clear the pending candidates
                pendingIceCandidates.length = 0;
              }
            } else {
              console.error('Cannot process answer: signaling state is', peerConnection.signalingState);
            }
          } catch (error) {
            console.error('Error handling WebRTC answer:', error);
          }
        }
        break;

      case 'webrtc_ice_candidate':
        console.log('Received ICE candidate');
        if (peerConnection && message.data.candidate) {
          try {
            // Check if we have remote description set before adding ICE candidates
            if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
              console.log('Adding ICE candidate');
              await peerConnection.addIceCandidate(new RTCIceCandidate(message.data.candidate));
            } else {
              console.log('Queueing ICE candidate as remote description is not set yet');
              // Queue the candidate to add later
              pendingIceCandidates.push(message.data.candidate);
            }
          } catch (error) {
            console.error('Error handling ICE candidate:', error);
          }
        }
        break;

      case 'chat_message':
        messageCallbacks.forEach(callback => callback(message.data));
        break;

      case 'user_left':
        console.log('Partner left the call');
        callEndedCallbacks.forEach(callback => callback());
        break;
        
      case 'end_call':
        console.log('Received end_call message from partner');
        // Clean up local resources but don't send another end_call message
        // to avoid infinite loop
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        if (peerConnection) {
          peerConnection.close();
        }
        
        if (websocket) {
          websocket.close();
        }
        
        // Reset variables
        localStream = null;
        remoteStream = null;
        peerConnection = null;
        websocket = null;
        currentRoomId = null;
        
        // Notify any callbacks
        callEndedCallbacks.forEach(callback => callback());
        break;

      case 'error':
        console.error('Server error:', message.message);
        break;

      default:
        console.log('Unknown message type:', message.type, message);
        break;
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        // Prevent camera flickering by not recreating the stream
      }
    }
  };

  // Screen sharing functionality has been removed as requested

  const endCall = () => {
    console.log('Ending call and notifying partner');
    
    try {
      // Notify partner that we're ending the call
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'end_call',
          data: {
            room_id: currentRoomId
          }
        }));
      }
    } catch (error) {
      console.error('Error sending end_call message:', error);
    }
    
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    // Close WebSocket connection
    if (websocket) {
      websocket.close();
    }

    // Reset variables
    localStream = null;
    remoteStream = null;
    peerConnection = null;
    websocket = null;
    currentRoomId = null;
    
    // Notify any callbacks
    callEndedCallbacks.forEach(callback => callback());
  };

  const sendMessage = (message: string) => {
    if (websocket) {
      websocket.send(JSON.stringify({
        type: 'chat_message',
        data: { text: message }
      }));
    }
  };

  // Callback management
  const messageCallbacks: Array<(message: any) => void> = [];
  const remoteStreamCallbacks: Array<(stream: MediaStream) => void> = [];
  const callEndedCallbacks: Array<() => void> = [];
  const partnerMatchedCallbacks: Array<(data: any) => void> = [];

  const onMessage = (callback: (message: any) => void) => {
    messageCallbacks.push(callback);
  };

  const onRemoteStream = (callback: (stream: MediaStream) => void) => {
    remoteStreamCallbacks.push(callback);
  };

  const onCallEnded = (callback: () => void) => {
    callEndedCallbacks.push(callback);
  };

  const onPartnerMatched = (callback: (data: any) => void) => {
    partnerMatchedCallbacks.push(callback);
  };

  return {
    localStream,
    remoteStream,
    peerConnection,
    websocket,
    initialize,
    joinRoom,
    toggleAudio,
    toggleVideo,
    endCall,
    sendMessage,
    onMessage,
    onRemoteStream,
    onCallEnded,
    onPartnerMatched
  };
};