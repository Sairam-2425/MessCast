const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Settings = require('../models/Settings');
const verifyJWT = require('../middleware/verifyJWT');

const router = express.Router();
router.use(verifyJWT);

const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Dynamic multer that reads from Settings
async function getFileUpload() {
  const settings = await Settings.findOne({});
  const maxSize = (settings?.maxFileSizeMB ?? 10) * 1024 * 1024;
  const allowedTypes = settings?.allowedMimeTypes ?? [];

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) cb(null, true);
      else cb(new Error('File type not allowed'), false);
    },
  });
}

async function sendPushNotifications(io, conversation, message, sender) {
  try {
    const otherMembers = conversation.members.filter((m) => m.toString() !== sender._id.toString());
    const users = await User.find({
      _id: { $in: otherMembers },
      isOnline: false,
      pushToken: { $ne: null },
    });

    const groupTitle = conversation.type === 'group' ? conversation.groupName : 'Direct message';
    const body = message.type === 'file' ? `📎 ${message.fileName || 'Sent a file'}` : message.content;

    const notifications = users.map((u) => ({
      to: u.pushToken,
      title: `${sender.displayName} · ${groupTitle}`,
      body,
      data: { conversationId: conversation._id.toString(), messageId: message._id.toString() },
      sound: 'default',
    }));

    if (notifications.length > 0) {
      await axios.post('https://exp.host/--/api/v2/push/send', notifications, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    }
  } catch (err) {
    console.error('[Push] Failed to send notifications:', err.message);
  }
}

// GET /api/messages/:conversationId
router.get('/:conversationId', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation.members.map((m) => m.toString()).includes(req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Message.countDocuments({
      conversation: req.params.conversationId,
      deletedForAll: false,
      deletedFor: { $ne: req.user.id },
    });

    const messages = await Message.find({
      conversation: req.params.conversationId,
      deletedForAll: false,
      deletedFor: { $ne: req.user.id },
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sender', 'displayName avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content fileName sender type',
        populate: { path: 'sender', select: 'displayName' },
      });

    res.json({
      messages,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/forward  — forward a message to one or more conversations
router.post('/forward', async (req, res, next) => {
  try {
    const { messageId, conversationIds } = req.body;
    if (!messageId) return res.status(400).json({ error: 'messageId required' });
    if (!Array.isArray(conversationIds) || conversationIds.length === 0)
      return res.status(400).json({ error: 'conversationIds (array) required' });

    const source = await Message.findById(messageId);
    if (!source) return res.status(404).json({ error: 'Source message not found' });
    if (source.deletedForAll) return res.status(400).json({ error: 'Cannot forward a deleted message' });

    const io = req.app.get('io');
    const results = [];

    for (const conversationId of conversationIds) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) continue;
      if (!conversation.members.map((m) => m.toString()).includes(req.user.id)) continue;

      const msgData = {
        conversation: conversationId,
        sender:       req.user.id,
        type:         source.type,
        isForwarded:  true,
      };
      if (source.type === 'text') {
        msgData.content = source.content;
      } else {
        msgData.fileUrl      = source.fileUrl;
        msgData.fileName     = source.fileName;
        msgData.fileSize     = source.fileSize;
        msgData.fileMimeType = source.fileMimeType;
      }

      const message = await Message.create(msgData);

      conversation.lastMessage = message._id;
      for (const entry of conversation.unreadCounts) {
        if (entry.user.toString() !== req.user.id) entry.count += 1;
      }
      conversation.markModified('unreadCounts');
      await conversation.save();

      const populated = await Message.findById(message._id)
        .populate('sender', 'displayName avatarUrl');

      io.to(conversationId).emit('new_message', populated);
      results.push(populated);
    }

    res.status(201).json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/bulk-read  — mark all unread messages in a conversation as read
router.post('/bulk-read', async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation.members.map((m) => m.toString()).includes(req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        sender:       { $ne: req.user.id },
        readBy:       { $ne: req.user.id },
        deletedForAll: false,
      },
      { $addToSet: { readBy: req.user.id } }
    );

    await Conversation.updateOne(
      { _id: conversationId, 'unreadCounts.user': req.user.id },
      { $set: { 'unreadCounts.$.count': 0 } }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/text
router.post('/text', async (req, res, next) => {
  try {
    const { conversationId, content, replyTo } = req.body;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation.members.map((m) => m.toString()).includes(req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const msgData = {
      conversation: conversationId,
      sender: req.user.id,
      type: 'text',
      content: content.trim(),
    };
    if (replyTo) msgData.replyTo = replyTo;

    const message = await Message.create(msgData);

    // Update conversation lastMessage and unreadCounts
    conversation.lastMessage = message._id;
    for (const entry of conversation.unreadCounts) {
      if (entry.user.toString() !== req.user.id) entry.count += 1;
    }
    conversation.markModified('unreadCounts');
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'displayName avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content fileName sender type',
        populate: { path: 'sender', select: 'displayName' },
      });

    const io = req.app.get('io');
    io.to(conversationId).emit('new_message', populated);

    const sender = await User.findById(req.user.id).select('displayName');
    await sendPushNotifications(io, conversation, populated, sender);

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/file
router.post('/file', async (req, res, next) => {
  try {
    const settings = await Settings.findOne({});
    if (settings && !settings.fileSharingEnabled) {
      return res.status(403).json({ error: 'File sharing is disabled' });
    }

    const upload = await getFileUpload();
    upload.single('file')(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const { conversationId, replyTo } = req.body;
      if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (!conversation.members.map((m) => m.toString()).includes(req.user.id)) {
        return res.status(403).json({ error: 'Not a member' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const msgData = {
        conversation: conversationId,
        sender: req.user.id,
        type: 'file',
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
      };
      if (replyTo) msgData.replyTo = replyTo;

      const message = await Message.create(msgData);

      conversation.lastMessage = message._id;
      for (const entry of conversation.unreadCounts) {
        if (entry.user.toString() !== req.user.id) entry.count += 1;
      }
      conversation.markModified('unreadCounts');
      await conversation.save();

      const populated = await Message.findById(message._id)
        .populate('sender', 'displayName avatarUrl')
        .populate({
          path: 'replyTo',
          select: 'content fileName sender type',
          populate: { path: 'sender', select: 'displayName' },
        });

      const io = req.app.get('io');
      io.to(conversationId).emit('new_message', populated);

      const sender = await User.findById(req.user.id).select('displayName');
      await sendPushNotifications(io, conversation, populated, sender);

      res.status(201).json(populated);
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (!message.readBy.map((u) => u.toString()).includes(req.user.id)) {
      message.readBy.push(req.user.id);
      await message.save();
    }

    await Conversation.updateOne(
      { _id: message.conversation, 'unreadCounts.user': req.user.id },
      { $set: { 'unreadCounts.$.count': 0 } }
    );

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message_read', {
      messageId: message._id,
      userId: req.user.id,
      conversationId: message.conversation,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/:id/react
router.post('/:id/react', async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) {
      return res.status(400).json({ error: 'Invalid emoji reaction' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const reactionGroup = message.reactions.find((r) => r.emoji === emoji);
    if (reactionGroup) {
      const userIdx = reactionGroup.users.map((u) => u.toString()).indexOf(req.user.id);
      if (userIdx >= 0) {
        reactionGroup.users.splice(userIdx, 1);
      } else {
        reactionGroup.users.push(req.user.id);
      }
    } else {
      message.reactions.push({ emoji, users: [req.user.id] });
    }

    // Clean up empty reaction groups
    message.reactions = message.reactions.filter((r) => r.users.length > 0);
    await message.save();

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('reaction_updated', {
      messageId: message._id,
      reactions: message.reactions,
    });

    res.json({ reactions: message.reactions });
  } catch (err) {
    next(err);
  }
});

// POST /api/messages/:id/pin
router.post('/:id/pin', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const isAdmin =
      req.user.role === 'admin' ||
      conversation.groupAdmins?.map((a) => a.toString()).includes(req.user.id) ||
      conversation.type === 'direct';

    if (!isAdmin) return res.status(403).json({ error: 'Not authorized to pin' });

    message.isPinned = true;
    await message.save();
    conversation.pinnedMessage = message._id;
    await conversation.save();

    const populated = await Message.findById(message._id).populate('sender', 'displayName avatarUrl');

    const io = req.app.get('io');
    io.to(conversation._id.toString()).emit('message_pinned', {
      conversationId: conversation._id,
      message: populated,
    });

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/messages/:id/pin
router.delete('/:id/pin', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    message.isPinned = false;
    await message.save();

    await Conversation.updateOne(
      { _id: message.conversation, pinnedMessage: message._id },
      { $set: { pinnedMessage: null } }
    );

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message_unpinned', {
      conversationId: message.conversation,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/:id  — edit message text (sender only)
router.patch('/:id', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender.toString() !== req.user.id) return res.status(403).json({ error: 'Only sender can edit' });
    if (message.type !== 'text') return res.status(400).json({ error: 'Only text messages can be edited' });

    message.content  = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'displayName avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content fileName sender type',
        populate: { path: 'sender', select: 'displayName' },
      });

    req.app.get('io').to(message.conversation.toString()).emit('message_edited', populated);
    res.json(populated);
  } catch (err) { next(err); }
});

// GET /api/messages/:conversationId/search?q=…
router.get('/:conversationId/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.status(400).json({ error: 'Query required' });

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!conversation.members.map((m) => m.toString()).includes(req.user.id))
      return res.status(403).json({ error: 'Not a member' });

    const messages = await Message.find({
      conversation: req.params.conversationId,
      type: 'text',
      content: { $regex: q.trim(), $options: 'i' },
      deletedForAll: false,
      deletedFor: { $ne: req.user.id },
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .populate('sender', 'displayName avatarUrl');

    res.json(messages);
  } catch (err) { next(err); }
});

// DELETE /api/messages/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { deleteFor } = req.body;
    if (!['me', 'everyone'].includes(deleteFor)) return res.status(400).json({ error: 'deleteFor must be "me" or "everyone"' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (deleteFor === 'everyone') {
      if (message.sender.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only sender can delete for everyone' });
      }
      const ageMins = (Date.now() - new Date(message.createdAt).getTime()) / 60_000;
      if (ageMins > 15 && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Delete for everyone is only available within 15 minutes of sending' });
      }
      message.deletedForAll = true;
      message.content = null;
      message.fileUrl = null;
    } else {
      if (!message.deletedFor.map((u) => u.toString()).includes(req.user.id)) {
        message.deletedFor.push(req.user.id);
      }
    }
    await message.save();

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message_deleted', {
      messageId: message._id,
      conversationId: message.conversation,
      deletedForAll: message.deletedForAll,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/messages/:id/delivered
router.patch('/:id/delivered', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (!message.deliveredTo.map((u) => u.toString()).includes(req.user.id)) {
      message.deliveredTo.push(req.user.id);
      await message.save();
    }

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message_delivered', {
      messageId: message._id,
      userId: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
