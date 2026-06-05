const { Schema, model } = require('mongoose');

const reactionSchema = new Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation:  { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:          { type: String, enum: ['text', 'file'], default: 'text' },
    content:       { type: String, default: null },
    fileUrl:       { type: String, default: null },
    fileName:      { type: String, default: null },
    fileSize:      { type: Number, default: null },
    fileMimeType:  { type: String, default: null },
    replyTo:       { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions:     [reactionSchema],
    readBy:        [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedFor:    [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedForAll: { type: Boolean, default: false },
    isEdited:     { type: Boolean, default: false },
    editedAt:     { type: Date, default: null },
    isPinned:     { type: Boolean, default: false },
    isForwarded:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('Message', messageSchema);
