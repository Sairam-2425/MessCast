const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

module.exports = function socketHandler(io) {
  // JWT auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user;
    const userId = user.id;

    // Join personal room for targeted events (e.g. force logout)
    socket.join(`user_${userId}`);

    // Mark user online
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: null });
    } catch {}

    // Broadcast online status to all conversation rooms this user is in
    async function emitOnlineToRooms(event, payload) {
      try {
        const conversations = await Conversation.find({ members: userId }).select('_id');
        conversations.forEach((c) => {
          socket.to(c._id.toString()).emit(event, payload);
        });
      } catch {}
    }

    await emitOnlineToRooms('user_online', { userId });

    // ── Conversation room events ──────────────────────────────────────────────

    socket.on('join_conversation', (conversationId) => {
      if (typeof conversationId === 'string') socket.join(conversationId);
    });

    socket.on('leave_conversation', (conversationId) => {
      if (typeof conversationId === 'string') socket.leave(conversationId);
    });

    // ── Typing indicators ─────────────────────────────────────────────────────

    socket.on('typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing', {
        conversationId,
        user: { id: userId, displayName: user.displayName },
      });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('stop_typing', { conversationId, userId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      try {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
        await emitOnlineToRooms('user_offline', { userId, lastSeen });
      } catch {}
    });
  });
};
