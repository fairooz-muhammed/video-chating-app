# video-chating-app
A modern React-based video calling application with real-time chat functionality using WebRTC and Socket.io.

## Features

- 🎥 **WebRTC Video Calling** - High-quality peer-to-peer video communication
- 💬 **Real-time Chat** - Instant messaging during video calls
- 🎛️ **Media Controls** - Mute/unmute audio and toggle video on/off
- 🏠 **Room-based System** - Join specific rooms using room IDs
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🔄 **Connection Status** - Real-time connection and user status indicators

## Quick Start

### 1. Start the Signaling Server

```bash
# Navigate to server directory
cd server

# Install dependencies (already done)
npm install

# Start the server
npm start
```

The server will run on `http://localhost:3001`

### 2. Start the React App

```bash
# In the main project directory
npm start
```

The app will run on `http://localhost:5173`

## How to Use

1. **Open two browser tabs/windows** or use different devices
2. **Enter the same Room ID** in both instances (default: "room-1")
3. **Click "Join Call"** in both windows
4. **Grant camera/microphone permissions** when prompted
5. **Start video chatting!** Use the chat panel on the right for messaging

## Technical Architecture

### Frontend (React + TypeScript)
- **WebRTC** for peer-to-peer video communication
- **Socket.io Client** for signaling and chat messaging
- **Tailwind CSS** for modern, responsive styling
- **Lucide React** for icons

### Backend (Node.js + Express)
- **Socket.io Server** for WebRTC signaling
- **Room management** for organizing users
- **CORS enabled** for cross-origin requests

### WebRTC Flow
1. User joins room via Socket.io
2. First user creates offer and sends via signaling server
3. Second user receives offer, creates answer
4. ICE candidates exchanged for optimal connection
5. Direct peer-to-peer connection established
6. Video/audio streams exchanged directly between peers

## Project Structure

```
├── src/
│   ├── components/
│   │   └── VideoCall.tsx     # Main video call component
│   ├── App.tsx               # Root component
│   └── main.tsx              # Entry point
├── server/
│   ├── server.js             # Socket.io signaling server
│   └── package.json          # Server dependencies
└── README.md                 # This file
```

## Development Notes

- **STUN servers** are configured for NAT traversal
- **Local and remote video** streams are handled separately
- **Connection state management** handles disconnections gracefully
- **Chat messages** persist during the session
- **Media permissions** are requested on join call

## Browser Compatibility

- Chrome/Chromium-based browsers (recommended)
- Firefox
- Safari (with some limitations)
- Edge

## Troubleshooting

1. **Camera/microphone not working**: Check browser permissions
2. **Can't connect to peer**: Ensure both users are in the same room
3. **Server connection issues**: Verify the signaling server is running on port 3001
4. **Video not showing**: Try refreshing the page and rejoining the call
