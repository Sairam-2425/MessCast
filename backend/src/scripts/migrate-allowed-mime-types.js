/**
 * migrate-allowed-mime-types.js
 *
 * The live Settings document was created before voice-message MIME types were
 * added to the schema's default allowedMimeTypes list — Mongoose schema
 * defaults only apply when a document is first created, so the stored array
 * never picked up the additions, and uploads with those MIME types are
 * rejected with "File type not allowed".
 *
 * This merges the currently-required voice MIME types into the EXISTING
 * document's allowedMimeTypes array (de-duplicated, nothing removed).
 *
 * Run once:
 *   node src/scripts/migrate-allowed-mime-types.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Settings = require('../models/Settings');

const REQUIRED_AUDIO_TYPES = [
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[migrate] Connected to MongoDB');

  let settings = await Settings.findOne({});
  if (!settings) settings = await Settings.create({});

  const before  = settings.allowedMimeTypes ?? [];
  const missing = REQUIRED_AUDIO_TYPES.filter((t) => !before.includes(t));

  if (missing.length === 0) {
    console.log('[migrate] All required audio MIME types are already present — nothing to do.');
  } else {
    settings.allowedMimeTypes = [...before, ...missing];
    await settings.save();
    console.log(`[migrate] Added missing MIME type(s): ${missing.join(', ')}`);
    console.log(`[migrate] allowedMimeTypes now: ${settings.allowedMimeTypes.join(', ')}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1);
});
