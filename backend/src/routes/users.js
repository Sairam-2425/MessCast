const express  = require('express');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const User     = require('../models/User');
const verifyJWT = require('../middleware/verifyJWT');
const storage  = require('../services/storage');

const router = express.Router();

const avatarUpload = multer({
  storage: storage.multerStorage('avatars'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed for avatars'), false);
  },
});

router.use(verifyJWT);

// GET /api/users/search?q=&exclude=
router.get('/search', async (req, res, next) => {
  try {
    const { q = '', exclude = '' } = req.query;
    const excludeIds = [req.user.id, ...(exclude ? [exclude] : [])];

    const users = await User.find({
      _id: { $nin: excludeIds },
      $or: [
        { displayName: { $regex: q, $options: 'i' } },
        { email:       { $regex: q, $options: 'i' } },
      ],
    })
      .select('displayName email avatarUrl isOnline lastSeen')
      .limit(20);

    res.json(users.map((u) => ({
      id:          u._id,
      displayName: u.displayName,
      email:       u.email,
      avatarUrl:   u.avatarUrl,
      isOnline:    u.isOnline,
      lastSeen:    u.lastSeen,
    })));
  } catch (err) { next(err); }
});

// GET /api/users/me
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/me
router.patch('/me', async (req, res, next) => {
  try {
    const { displayName, email, bio } = req.body;
    const updates = {};
    if (displayName && displayName.trim()) updates.displayName = displayName.trim();
    if (email)        updates.email = email.toLowerCase();
    if (bio !== undefined) updates.bio = bio ? bio.trim() : null;

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { next(err); }
});

// POST /api/users/avatar
router.post('/avatar', avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const user = await User.findById(req.user.id);

    // Delete previous avatar from whichever storage backend holds it
    if (user.avatarUrl) {
      await storage.deleteFile(user.avatarUrl);
    }

    const avatarUrl = storage.getPublicUrl(await storage.uploadFile(req.file, 'messcast/avatars'));
    user.avatarUrl = avatarUrl;
    await user.save();

    res.json({ avatarUrl });
  } catch (err) { next(err); }
});

// PATCH /api/users/me/password
router.patch('/me/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== 'string')
      return res.status(400).json({ error: 'Current password is required' });
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.password)
      return res.status(400).json({ error: 'No password is set on this account. Contact an admin.' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/users/me/push-token
router.patch('/me/push-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    await User.findByIdAndUpdate(req.user.id, { pushToken: token });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('displayName avatarUrl isOnline lastSeen email phone bio');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id:          user._id,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
      email:       user.email   ?? null,
      phone:       user.phone   ?? null,
      bio:         user.bio     ?? null,
      isOnline:    user.isOnline,
      lastSeen:    user.lastSeen,
    });
  } catch (err) { next(err); }
});

module.exports = router;
