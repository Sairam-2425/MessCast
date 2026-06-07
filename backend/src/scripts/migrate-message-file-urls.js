/**
 * migrate-message-file-urls.js
 *
 * Finds every Message whose fileUrl still points to a local /uploads/ path
 * (stored during the old disk-storage era, before the Cloudinary migration)
 * and clears its file fields. Render's disk is ephemeral — those files no
 * longer exist on the server — so leaving the relative path in place causes
 * clients to prefix it with their own base URL, producing broken links such
 * as http://localhost:5000/uploads/messcast/uploads/<file>.
 *
 * Run once after deploying the Cloudinary migration:
 *   node src/scripts/migrate-message-file-urls.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Message  = require('../models/Message');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[migrate] Connected to MongoDB');

  const staleMessages = await Message.find({
    fileUrl: { $regex: '^/uploads/', $options: 'i' },
  });

  console.log(`[migrate] Found ${staleMessages.length} message(s) with stale local file paths`);

  for (const message of staleMessages) {
    console.log(`  Clearing file fields for message ${message._id} — was: ${message.fileUrl}`);
    message.fileUrl      = null;
    message.fileName     = null;
    message.fileSize     = null;
    message.fileMimeType = null;
    await message.save();
  }

  console.log('[migrate] Done.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1);
});
