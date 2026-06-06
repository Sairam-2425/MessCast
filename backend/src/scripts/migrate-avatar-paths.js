/**
 * migrate-avatar-paths.js
 *
 * Finds every User and Conversation whose avatar still points to a local
 * /uploads/ path (stored during the old disk-storage era) and nulls it out
 * so the mobile app shows initials instead of a broken image.
 *
 * Run once after deploying the Cloudinary migration:
 *   node src/scripts/migrate-avatar-paths.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose     = require('mongoose');
const User         = require('../models/User');
const Conversation = require('../models/Conversation');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[migrate] Connected to MongoDB');

  // ── Users ─────────────────────────────────────────────────────────────────
  const staleUsers = await User.find({
    avatarUrl: { $regex: '^/uploads/', $options: 'i' },
  });

  console.log(`[migrate] Found ${staleUsers.length} user(s) with stale local avatar paths`);

  for (const user of staleUsers) {
    console.log(`  Clearing avatarUrl for ${user.displayName} (${user._id}) — was: ${user.avatarUrl}`);
    user.avatarUrl = null;
    await user.save();
  }

  // ── Conversations (group avatars) ─────────────────────────────────────────
  const staleConvs = await Conversation.find({
    groupAvatar: { $regex: '^/uploads/', $options: 'i' },
  });

  console.log(`[migrate] Found ${staleConvs.length} group(s) with stale local avatar paths`);

  for (const conv of staleConvs) {
    console.log(`  Clearing groupAvatar for conversation ${conv._id} — was: ${conv.groupAvatar}`);
    conv.groupAvatar = null;
    await conv.save();
  }

  console.log('[migrate] Done. Users and groups will show initials until a new avatar is uploaded.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1);
});
