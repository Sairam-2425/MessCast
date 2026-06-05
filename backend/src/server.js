const path = require('path');
// Load .env relative to this file — works regardless of where nodemon is started from
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');
const { logFirebaseConfig } = require('./utils/firebaseAdmin');

const authRoutes          = require('./routes/auth');
const userRoutes          = require('./routes/users');
const conversationRoutes  = require('./routes/conversations');
const messageRoutes       = require('./routes/messages');
const adminRoutes         = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// --- Socket.IO ---
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
socketHandler(io);

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

// --- Core middleware ---
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- Static files ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Routes ---
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/admin',         adminRoutes);

// --- Health check ---
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// --- Global error handler ---
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  else console.error(`[ERROR] ${err.message}`);

  if (err.code === 'LIMIT_FILE_SIZE')       return res.status(413).json({ error: 'File too large' });
  if (err.message === 'File type not allowed') return res.status(415).json({ error: 'File type not allowed' });
  if (err.name === 'ValidationError')       return res.status(400).json({ error: err.message });
  if (err.code === 11000)                   return res.status(409).json({ error: 'Duplicate key error' });
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

// --- Start ---
const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => {
    logFirebaseConfig();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
