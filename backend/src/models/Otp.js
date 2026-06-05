/**
 * OTP collection — stores one-time codes for phone verification.
 *
 * Design decisions:
 *  • Separate collection (not on User) keeps User clean and lets MongoDB TTL
 *    auto-delete expired OTPs without touching user documents.
 *  • `used` flag prevents replay attacks even before TTL fires.
 *  • One active OTP per phone+purpose: sending a new OTP invalidates old ones.
 */
const { Schema, model } = require('mongoose');

const otpSchema = new Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['signup', 'reset'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// MongoDB TTL index — documents are auto-deleted when expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookup by phone + purpose (used in verifyOtp).
otpSchema.index({ phone: 1, purpose: 1 });

module.exports = model('Otp', otpSchema);
