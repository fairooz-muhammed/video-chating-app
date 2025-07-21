const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    rooms.get(roomId).add(socket.id);
    
    // Notify others in the room that a user joined
    socket.to(roomId).emit('user-joined');
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    console.log(`Room ${roomId} now has ${rooms.get(roomId).size} users`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
    
    // Notify others in the room that a user left
    socket.to(roomId).emit('user-left');
    
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', data.offer);
  });

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', data.answer);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', data.candidate);
  });

  // Chat messaging
  socket.on('chat-message', (data) => {
    socket.to(data.roomId).emit('chat-message', {
      message: data.message,
      sender: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up rooms
    for (let [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit('user-left');
        
        if (users.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});