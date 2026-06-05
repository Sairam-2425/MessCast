require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Settings = require('../models/Settings');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Seed admin user
  const existing = await User.findOne({ email: 'admin@messcast.app' });
  if (!existing) {
    const hashed = await bcrypt.hash('Admin1234!', 12);
    await User.create({
      displayName: 'MessCast Admin',
      email: 'admin@messcast.app',
      password: hashed,
      role: 'admin',
    });
    console.log('Admin user created: admin@messcast.app / Admin1234!');
  } else {
    console.log('Admin user already exists');
  }

  // Seed default settings if none exist
  const settings = await Settings.findOne({});
  if (!settings) {
    await Settings.create({});
    console.log('Default settings created');
  } else {
    console.log('Settings already exist');
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
