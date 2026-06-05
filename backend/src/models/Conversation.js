const { Schema, model } = require('mongoose');

const conversationSchema = new Schema(
  {
    type:          { type: String, enum: ['direct', 'group'], required: true },
    members:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
    groupName:     { type: String, default: null },
    groupAvatar:   { type: String, default: null },
    groupAdmins:   [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessage:   { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    pinnedMessage: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    unreadCounts:  [
      {
        user:  { type: Schema.Types.ObjectId, ref: 'User' },
        count: { type: Number, default: 0 },
      },
    ],
    deletedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = model('Conversation', conversationSchema);
