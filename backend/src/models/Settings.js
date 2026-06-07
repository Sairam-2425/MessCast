const { Schema, model } = require('mongoose');

const settingsSchema = new Schema({
  maxFileSizeMB:       { type: Number, default: 10 },
  fileSharingEnabled:  { type: Boolean, default: true },
  registrationEnabled: { type: Boolean, default: true },
  allowedMimeTypes: {
    type: [String],
    default: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'video/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/m4a',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
      'audio/wav',
      'audio/x-wav',
      'audio/webm',
    ],
  },
  storageAlertMB: { type: Number, default: 500 },
});

module.exports = model('Settings', settingsSchema);
