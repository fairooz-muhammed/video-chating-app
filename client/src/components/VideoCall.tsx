import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Send, Users } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  text: string;
  sender: 'local' | 'remote';
  timestamp: number;
}

const VideoCall: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('room-1');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to signaling server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setIsConnected(false);
    });

    newSocket.on('user-joined', () => {
      setRemoteUserConnected(true);
    });

    newSocket.on('user-left', () => {
      setRemoteUserConnected(false);
      handleRemoteUserLeft();
    });

    newSocket.on('chat-message', (data: { message: string; sender: string }) => {
      addMessage(data.message, 'remote');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // WebRTC signaling handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnection) return;
      
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { answer, roomId });
    });

    socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(answer);
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidate) => {
      if (!peerConnection) return;
      await peerConnection.addIceCandidate(candidate);
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket, peerConnection, roomId]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { candidate: event.candidate, roomId });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleRemoteUserLeft();
      }
    };

    return pc;
  }, [socket, roomId]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const joinCall = async () => {
    if (!socket) {
      alert('Not connected to server');
      return;
    }

    const stream = await startLocalStream();
    if (!stream) return;

    const pc = createPeerConnection();
    setPeerConnection(pc);

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Join room
    socket.emit('join-room', roomId);
    setIsCallActive(true);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { offer, roomId });
  };

  const leaveCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    setRemoteStream(null);
    setIsCallActive(false);
    setRemoteUserConnected(false);

    if (socket) {
      socket.emit('leave-room', roomId);
    }
  };

  const handleRemoteUserLeft = () => {
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const addMessage = (text: string, sender: 'local' | 'remote') => {
    const message: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, message]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socket) return;

    addMessage(messageInput, 'local');
    socket.emit('chat-message', { message: messageInput, roomId });
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Video Chat App</h1>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className={`flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              {isConnected ? 'Connected to server' : 'Disconnected from server'}
            </div>
            {remoteUserConnected && (
              <div className="flex items-center gap-2 text-blue-400">
                <Users size={16} />
                Remote user connected
              </div>
            )}
          </div>
        </div>

        {/* Room Selection */}
        {!isCallActive && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 max-w-md mx-auto">
            <label className="block text-white mb-2 font-medium">Room ID:</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder="Enter room ID"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Section */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                {/* Local Video */}
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                    You {isVideoOff && '(Camera Off)'}
                  </div>
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                      <VideoOff size={48} className="text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Remote Video */}
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!remoteStream && (
                    <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Users size={48} className="mx-auto mb-2" />
                        <p>Waiting for remote user...</p>
                      </div>
                    </div>
                  )}
                  {remoteStream && (
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                      Remote User
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-4 mt-4">
                {!isCallActive ? (
                  <button
                    onClick={joinCall}
                    disabled={!isConnected}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Phone size={20} />
                    Join Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={`p-3 rounded-lg transition-colors ${
                        isMuted
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-gray-500 hover:bg-gray-600'
                      } text-white`}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button
                      onClick={toggleVideo}
                      className={`p-3 rounded-lg transition-colors ${
                        isVideoOff
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-gray-500 hover:bg-gray-600'
                      } text-white`}
                    >
                      {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    <button
                      onClick={leaveCall}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      <PhoneOff size={20} />
                      Leave Call
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 h-[600px] flex flex-col">
            <h3 className="text-white font-semibold mb-4">Chat</h3>
            
            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'local' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                      message.sender === 'local'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    <p>{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === 'local' ? 'text-blue-100' : 'text-white/70'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;