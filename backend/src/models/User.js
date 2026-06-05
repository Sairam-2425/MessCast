const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true },

    // Sparse unique so multiple null values are allowed
    email: {
      type: String,
      default: null,
      lowercase: true,
      sparse: true,
      unique: true,
    },

    // E.164 format, e.g. +919876543210
    phone: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },

    isPhoneVerified: { type: Boolean, default: false },

    // Nullable — phone-only users (OTP-based login) have no password
    password:    { type: String, default: null },
    avatarUrl:   { type: String, default: null },
    role:        { type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned:    { type: Boolean, default: false },
    pushToken:   { type: String, default: null },
    isOnline:    { type: Boolean, default: false },
    lastSeen:    { type: Date,    default: null },
    bio:           { type: String, default: null, trim: true },
    archivedChats: [{ type: Schema.Types.ObjectId, ref: 'Conversation' }],
    pinnedChats:   [{ type: Schema.Types.ObjectId, ref: 'Conversation' }],
  },
  { timestamps: true }
);

userSchema.pre('save', function (next) {
  if (!this.email && !this.phone) {
    return next(new Error('User must have at least an email or phone number'));
  }
  next();
});

module.exports = model('User', userSchema);
