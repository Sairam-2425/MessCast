const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');

// Multer storage for group avatars — same directory as user avatars for simplicity.
const groupAvatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(__dirname, '../../uploads/avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `group_${req.params.id}_${Date.now()}${ext}`);
  },
});
const groupAvatarUpload = multer({
  storage: groupAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed for group avatars'), false);
  },
});

const router = express.Router();
router.use(verifyJWT);

function populateConversation(query) {
  return query
    .populate('members', 'displayName avatarUrl isOnline lastSeen')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'displayName' },
    })
    .populate('pinnedMessage');
}

// GET /api/conversations
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('archivedChats pinnedChats');
    const archivedIds = user.archivedChats.map((id) => id.toString());
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));

    const conversations = await populateConversation(
      Conversation.find({
        members: req.user.id,
        _id: { $nin: archivedIds },
        deletedBy: { $ne: req.user.id },
      }).sort({ updatedAt: -1 })
    );

    const result = conversations.map((c) => formatConversation(c, req.user.id, pinnedIds));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/archived
router.get('/archived', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('archivedChats pinnedChats');
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));
    const conversations = await populateConversation(
      Conversation.find({ _id: { $in: user.archivedChats }, members: req.user.id }).sort({ updatedAt: -1 })
    );
    res.json(conversations.map((c) => formatConversation(c, req.user.id, pinnedIds)));
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/pinned
router.get('/pinned', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('pinnedChats');
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));
    const conversations = await populateConversation(
      Conversation.find({ _id: { $in: user.pinnedChats }, members: req.user.id })
    );
    res.json(conversations.map((c) => formatConversation(c, req.user.id, pinnedIds)));
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations
router.post('/', async (req, res, next) => {
  try {
    const { type, members, groupName, groupAvatar } = req.body;
    if (!type || !['direct', 'group'].includes(type)) return res.status(400).json({ error: 'Valid type required' });
    if (!members || !Array.isArray(members)) return res.status(400).json({ error: 'Members array required' });

    const allMembers = [...new Set([req.user.id, ...members])];

    if (type === 'direct') {
      if (allMembers.length !== 2) return res.status(400).json({ error: 'Direct chat requires exactly 2 members' });

      const existing = await Conversation.findOne({
        type: 'direct',
        members: { $all: allMembers, $size: 2 },
      });
      if (existing) {
        const populated = await populateConversation(Conversation.findById(existing._id));
        return res.json(formatConversation(populated, req.user.id));
      }
    }

    if (type === 'group') {
      if (!groupName || !groupName.trim()) return res.status(400).json({ error: 'Group name required' });
      if (allMembers.length < 2) return res.status(400).json({ error: 'Group requires at least 2 members' });
    }

    const unreadCounts = allMembers.map((userId) => ({ user: userId, count: 0 }));
    const convData = {
      type,
      members: allMembers,
      unreadCounts,
      createdBy: req.user.id,
    };
    if (type === 'group') {
      convData.groupName = groupName.trim();
      convData.groupAdmins = [req.user.id];
      if (groupAvatar) convData.groupAvatar = groupAvatar;
    }

    const conversation = await Conversation.create(convData);
    const [populated, user] = await Promise.all([
      populateConversation(Conversation.findById(conversation._id)),
      User.findById(req.user.id).select('pinnedChats'),
    ]);
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));
    res.status(201).json(formatConversation(populated, req.user.id, pinnedIds));
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [conversation, user] = await Promise.all([
      populateConversation(Conversation.findById(req.params.id)),
      User.findById(req.user.id).select('pinnedChats'),
    ]);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!isMember(conversation, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));
    res.json(formatConversation(conversation, req.user.id, pinnedIds));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/conversations/:id/group
router.patch('/:id/group', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.type !== 'group') return res.status(400).json({ error: 'Not a group' });
    if (!isGroupAdmin(conversation, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can edit group info' });
    }

    const { groupName, groupAvatar } = req.body;
    if (groupName) conversation.groupName = groupName.trim();
    if (groupAvatar) conversation.groupAvatar = groupAvatar;
    await conversation.save();

    const [populated, user] = await Promise.all([
      populateConversation(Conversation.findById(conversation._id)),
      User.findById(req.user.id).select('pinnedChats'),
    ]);
    const pinnedIds = new Set(user.pinnedChats.map((id) => id.toString()));
    res.json(formatConversation(populated, req.user.id, pinnedIds));
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/members
router.post('/:id/members', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.type !== 'group') return res.status(400).json({ error: 'Not a group' });
    if (!isGroupAdmin(conversation, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    if (!conversation.members.map((m) => m.toString()).includes(userId)) {
      conversation.members.push(userId);
      conversation.unreadCounts.push({ user: userId, count: 0 });
      await conversation.save();
    }

    const io = req.app.get('io');
    io.to(req.params.id).emit('member_added', { conversationId: req.params.id, userId });

    const [populated, userDoc] = await Promise.all([
      populateConversation(Conversation.findById(conversation._id)),
      User.findById(req.user.id).select('pinnedChats'),
    ]);
    const pinnedIds = new Set(userDoc.pinnedChats.map((id) => id.toString()));
    res.json(formatConversation(populated, req.user.id, pinnedIds));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conversations/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.type !== 'group') return res.status(400).json({ error: 'Not a group' });

    const targetId = req.params.userId;
    const isSelf = targetId === req.user.id;
    if (!isSelf && !isGroupAdmin(conversation, req.user.id)) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    conversation.members = conversation.members.filter((m) => m.toString() !== targetId);
    conversation.unreadCounts = conversation.unreadCounts.filter((u) => u.user.toString() !== targetId);
    conversation.groupAdmins = conversation.groupAdmins.filter((a) => a.toString() !== targetId);
    await conversation.save();

    const io = req.app.get('io');
    io.to(req.params.id).emit('member_removed', { conversationId: req.params.id, userId: targetId });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/conversations/:id/admins
router.patch('/:id/admins', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.type !== 'group') return res.status(400).json({ error: 'Not a group' });
    if (conversation.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only group creator or app admin can manage group admins' });
    }

    const { userId, action } = req.body;
    if (!userId || !['promote', 'demote'].includes(action)) return res.status(400).json({ error: 'userId and action required' });

    const adminIds = conversation.groupAdmins.map((a) => a.toString());
    if (action === 'promote' && !adminIds.includes(userId)) {
      conversation.groupAdmins.push(userId);
    } else if (action === 'demote') {
      conversation.groupAdmins = conversation.groupAdmins.filter((a) => a.toString() !== userId);
    }
    await conversation.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/pin
router.post('/:id/pin', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const convId = req.params.id;
    const pinned = user.pinnedChats.map((p) => p.toString());
    let isPinned;

    if (pinned.includes(convId)) {
      user.pinnedChats = user.pinnedChats.filter((p) => p.toString() !== convId);
      isPinned = false;
    } else {
      user.pinnedChats.push(convId);
      isPinned = true;
    }
    await user.save();
    res.json({ isPinned });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/archive
router.post('/:id/archive', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const convId = req.params.id;
    const archived = user.archivedChats.map((a) => a.toString());
    let isArchived;

    if (archived.includes(convId)) {
      user.archivedChats = user.archivedChats.filter((a) => a.toString() !== convId);
      isArchived = false;
    } else {
      user.archivedChats.push(convId);
      isArchived = true;
    }
    await user.save();
    res.json({ isArchived });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conversations/:id  — soft-delete for current user only
router.delete('/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!isMember(conversation, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    if (!conversation.deletedBy.map((u) => u.toString()).includes(req.user.id)) {
      conversation.deletedBy.push(req.user.id);
      await conversation.save();
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/conversations/:id/pinned-message
router.get('/:id/pinned-message', async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate('pinnedMessage');
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!isMember(conversation, req.user.id)) return res.status(403).json({ error: 'Not a member' });
    res.json({ pinnedMessage: conversation.pinnedMessage });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/avatar
// Upload or replace the group avatar image.
// Allowed by group admins and app admins only.
router.post('/:id/avatar', (req, res, next) => {
  // Run multer first so req.file is populated before the async handler.
  groupAvatarUpload.single('avatar')(req, res, async (multerErr) => {
    if (multerErr) return next(multerErr);
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const conversation = await Conversation.findById(req.params.id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      if (conversation.type !== 'group') return res.status(400).json({ error: 'Not a group' });
      if (!isGroupAdmin(conversation, req.user.id) && req.user.role !== 'admin') {
        // Clean up the just-uploaded file before rejecting
        fs.unlink(req.file.path, () => {});
        return res.status(403).json({ error: 'Only group admins can change group image' });
      }

      // Delete the previous avatar from disk
      if (conversation.groupAvatar) {
        const oldFilename = path.basename(conversation.groupAvatar);
        const oldPath = path.join(__dirname, '../../uploads/avatars', oldFilename);
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      }

      const groupAvatar = `/uploads/avatars/${req.file.filename}`;
      conversation.groupAvatar = groupAvatar;
      await conversation.save();

      res.json({ groupAvatar });
    } catch (err) {
      next(err);
    }
  });
});

// --- Helpers ---
function isMember(conversation, userId) {
  return conversation.members.some((m) => m._id?.toString() === userId || m.toString() === userId);
}

function isGroupAdmin(conversation, userId) {
  return conversation.groupAdmins.some((a) => a._id?.toString() === userId || a.toString() === userId);
}

function formatConversation(conversation, userId, pinnedIds = new Set()) {
  const unreadEntry = conversation.unreadCounts?.find((u) => u.user?.toString() === userId);
  return {
    id: conversation._id,
    type: conversation.type,
    members: conversation.members,
    groupName: conversation.groupName,
    groupAvatar: conversation.groupAvatar,
    groupAdmins: conversation.groupAdmins,
    createdBy: conversation.createdBy,
    lastMessage: conversation.lastMessage,
    pinnedMessage: conversation.pinnedMessage,
    unreadCount: unreadEntry?.count ?? 0,
    isPinned: pinnedIds.has(conversation._id.toString()),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

module.exports = router;
