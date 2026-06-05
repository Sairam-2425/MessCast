const mongoose = require('mongoose');

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected. Mongoose will auto-reconnect.');
});
mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected.');
});
mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err.message);
});

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not defined in environment variables');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  console.log('[MongoDB] Connected:', mongoose.connection.host);
}

module.exports = connectDB;
