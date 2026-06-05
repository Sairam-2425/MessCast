const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Settings = require('../models/Settings');
const verifyJWT = require('../middleware/verifyJWT');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router();
router.use(verifyJWT, isAdmin);

// ─── Stats ───────────────────────────────────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalMessages, totalConversations, bannedUsers] = await Promise.all([
      User.countDocuments(),
      Message.countDocuments({ deletedForAll: false }),
      Conversation.countDocuments(),
      User.countDocuments({ isBanned: true }),
    ]);

    const fileMsgs = await Message.find({ type: 'file', fileUrl: { $ne: null } }).select('fileSize');
    const totalFiles = fileMsgs.length;
    const storageUsedMB = fileMsgs.reduce((acc, m) => acc + (m.fileSize || 0), 0) / (1024 * 1024);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = await User.countDocuments({ lastSeen: { $gte: today } });

    res.json({ totalUsers, totalMessages, totalFiles, totalConversations, storageUsedMB: Math.round(storageUsedMB * 100) / 100, bannedUsers, activeToday });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats/messages (last 30 days)
router.get('/stats/messages', async (req, res, next) => {
  try {
    const data = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          deletedForAll: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats/files
router.get('/stats/files', async (req, res, next) => {
  try {
    const data = await Message.aggregate([
      { $match: { type: 'file', fileUrl: { $ne: null } } },
      { $group: { _id: '$fileMimeType', count: { $sum: 1 } } },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/stats/registrations
router.get('/stats/registrations', async (req, res, next) => {
  try {
    const data = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const { search = '', role = '', isBanned = '', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (search) filter.$or = [{ displayName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (role) filter.role = role;
    if (isBanned !== '') filter.isBanned = isBanned === 'true';

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const [msgCount, fileCount] = await Promise.all([
      Message.countDocuments({ sender: req.params.id }),
      Message.countDocuments({ sender: req.params.id, type: 'file' }),
    ]);
    const groups = await Conversation.find({ type: 'group', members: req.params.id }).select('groupName members');
    res.json({ user, msgCount, fileCount, groups });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { displayName, email } = req.body;
    const updates = {};
    if (displayName) updates.displayName = displayName.trim();
    if (email) updates.email = email.toLowerCase();
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isBanned = !user.isBanned;
    await user.save();

    if (user.isBanned) {
      const io = req.app.get('io');
      io.to(`user_${req.params.id}`).emit('force_logout', { reason: 'banned' });
    }
    res.json({ isBanned: user.isBanned });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/password
router.patch('/users/:id/password', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res, next) => {
  try {
    const messages = await Message.find({ sender: req.params.id, type: 'file', fileUrl: { $ne: null } });
    for (const msg of messages) {
      const filePath = path.join(__dirname, '../../', msg.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
    await Message.deleteMany({ sender: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Conversations ────────────────────────────────────────────────────────────

// GET /api/admin/conversations
router.get('/conversations', async (req, res, next) => {
  try {
    const { type = '', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    const skip = (Number(page) - 1) * Number(limit);
    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .populate('members', 'displayName avatarUrl')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'displayName' } })
        .skip(skip).limit(Number(limit)).sort({ updatedAt: -1 }),
      Conversation.countDocuments(filter),
    ]);
    res.json({ conversations, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [messages, total] = await Promise.all([
      Message.find({ conversation: req.params.id })
        .populate('sender', 'displayName avatarUrl')
        .sort({ createdAt: 1 }).skip(skip).limit(Number(limit)),
      Message.countDocuments({ conversation: req.params.id }),
    ]);
    res.json({ messages, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/conversations/:id
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const messages = await Message.find({ conversation: req.params.id, type: 'file', fileUrl: { $ne: null } });
    for (const msg of messages) {
      const filePath = path.join(__dirname, '../../', msg.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
    await Message.deleteMany({ conversation: req.params.id });
    await Conversation.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/conversations/:id/members
router.patch('/conversations/:id/members', async (req, res, next) => {
  try {
    const { userId } = req.body;
    await Conversation.findByIdAndUpdate(req.params.id, {
      $pull: { members: userId, unreadCounts: { user: userId }, groupAdmins: userId },
    });
    const io = req.app.get('io');
    io.to(req.params.id).emit('member_removed', { conversationId: req.params.id, userId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.fileUrl) {
      const filePath = path.join(__dirname, '../../', message.fileUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    }
    await message.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Files ────────────────────────────────────────────────────────────────────

// GET /api/admin/files
router.get('/files', async (req, res, next) => {
  try {
    const { fileType = '', uploader = '', from = '', to = '', page = 1, limit = 20 } = req.query;
    const filter = { type: 'file', fileUrl: { $ne: null } };
    if (fileType) filter.fileMimeType = { $regex: fileType, $options: 'i' };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    let query = Message.find(filter)
      .populate('sender', 'displayName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    let [messages, total] = await Promise.all([query, Message.countDocuments(filter)]);

    if (uploader) {
      messages = messages.filter((m) =>
        m.sender?.displayName?.toLowerCase().includes(uploader.toLowerCase()) ||
        m.sender?.email?.toLowerCase().includes(uploader.toLowerCase())
      );
    }

    res.json({ files: messages, total, totalPages: Math.ceil(total / Number(limit)), currentPage: Number(page) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/files/:messageId
router.delete('/files/:messageId', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || !message.fileUrl) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(__dirname, '../../', message.fileUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});

    message.fileUrl = null;
    await message.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Broadcast ────────────────────────────────────────────────────────────────

// POST /api/admin/broadcast
// Sends a direct message from admin to every non-banned, non-admin user.
// Finds-or-creates a direct conversation per user, then emits via socket.
router.post('/broadcast', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const targets = await User.find({
      _id: { $ne: req.user.id },
      isBanned: false,
    }).select('_id');

    const io = req.app.get('io');
    let sentCount = 0;

    for (const target of targets) {
      try {
        // Find or create a direct conversation between admin and this user
        let conv = await Conversation.findOne({
          type: 'direct',
          members: { $all: [req.user.id, target._id.toString()], $size: 2 },
        });

        if (!conv) {
          conv = await Conversation.create({
            type: 'direct',
            members: [req.user.id, target._id],
            unreadCounts: [
              { user: req.user.id, count: 0 },
              { user: target._id, count: 0 },
            ],
            createdBy: req.user.id,
          });
        }

        const message = await Message.create({
          conversation: conv._id,
          sender: req.user.id,
          type: 'text',
          content: content.trim(),
        });

        // Increment unread count for the target user
        const unreadEntry = conv.unreadCounts.find(
          (u) => u.user.toString() === target._id.toString(),
        );
        if (unreadEntry) unreadEntry.count += 1;
        conv.lastMessage = message._id;
        conv.markModified('unreadCounts');
        await conv.save();

        const populated = await Message.findById(message._id).populate(
          'sender',
          'displayName avatarUrl',
        );

        io.to(conv._id.toString()).emit('new_message', populated);
        sentCount += 1;
      } catch {
        // Skip individual failures — don't abort the whole broadcast
      }
    }

    res.json({ sent: sentCount });
  } catch (err) {
    next(err);
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/settings
router.patch('/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) settings = await Settings.create({});
    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
