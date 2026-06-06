const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.warn('[Cloudinary] CLOUDINARY_CLOUD_NAME not set — uploads will fail');
}

module.exports = cloudinary;
