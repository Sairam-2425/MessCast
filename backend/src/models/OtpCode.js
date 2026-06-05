const { Schema, model } = require('mongoose');

const otpCodeSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true },
    // sessionId returned by 2Factor.in — passed to the VERIFY endpoint at check time
    sessionId: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['register', 'login', 'forgot_password'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    isUsed:    { type: Boolean, default: false },
    attempts:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// MongoDB auto-deletes documents once expiresAt has passed
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup by phone + purpose
otpCodeSchema.index({ phone: 1, purpose: 1 });

module.exports = model('OtpCode', otpCodeSchema);
