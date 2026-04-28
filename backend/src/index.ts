import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketHandler } from './websocket/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './middleware/logger.js';
import { aiRoutes } from './api/ai/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// In-memory storage
const rooms = new Map();

// ============ CORS CONFIGURATION ============
// Parse allowed origins from environment variable or use defaults
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'https://collab-editor-ruby-beta.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log(`❌ CORS blocked: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    console.log(`✅ CORS allowed: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(logger);

// ============ ROOM API ============

app.post('/api/rooms', (req, res) => {
  const roomId = uuidv4().slice(0, 8);
  const room = {
    id: roomId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    users: [],
    settings: {
      language: 'javascript',
      theme: 'vs-dark'
    }
  };
  
  rooms.set(roomId, room);
  
  res.status(201).json({
    success: true,
    roomId: roomId,
    room: room
  });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  
  res.json({ success: true, room });
});

app.delete('/api/rooms/:id', (req, res) => {
  const deleted = rooms.delete(req.params.id);
  
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  
  res.json({ success: true, message: 'Room deleted' });
});

app.get('/api/rooms', (req, res) => {
  const allRooms = Array.from(rooms.values());
  res.json({ success: true, rooms: allRooms });
});

// ============ AI ROUTES ============
app.use('/api/ai', aiRoutes);

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: rooms.size
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Collab Editor Backend',
    version: '1.0.0',
    status: 'running',
    activeRooms: rooms.size
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling
app.use(errorHandler);

// Initialize WebSocket
const wsHandler = new WebSocketHandler(wss);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  console.log(`💾 Using in-memory storage`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
});

export { app, server };