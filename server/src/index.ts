import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import authRoutes from './routes/authRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import versionRoutes from './routes/versionRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import { executeCode } from './controllers/executeController.js';
import { setupSocketIO } from './socket/socketHandler.js';

dotenv.config();

// Initialize SQLite Database schema and indexes
initDatabase();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Universal CORS allowing all origins, credentials, and headers
app.use(cors({
  origin: true, // Dynamically reflects request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Collaborative Code & Whiteboard API'
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/documents', versionRoutes);
app.use('/api/emails', emailRoutes);
app.post('/api/execute', executeCode);

// Setup Socket.IO real-time engine
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

setupSocketIO(io);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  Collaborative Code & Whiteboard Server Running       `);
    console.log(`  HTTP API:        http://localhost:${PORT}/api/health `);
    console.log(`  WebSocket Server: ws://localhost:${PORT}             `);
    console.log(`=======================================================`);
  });
}

export { app, server };
