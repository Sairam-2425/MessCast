/**
 * Storage abstraction layer.
 *
 * STORAGE_PROVIDER env var controls which backend is active:
 *   local      — Express static served from /uploads (dev default, not safe on Render)
 *   cloudinary — Cloudinary CDN (production default)
 *
 * Every route that handles file uploads must use:
 *   multer({ storage: storage.multerStorage(), limits: ..., fileFilter: ... })
 *   const url = await storage.uploadFile(req.file, 'folder-name');
 *   await storage.deleteFile(oldUrl);
 */

const path = require('path');
const fs   = require('fs');
const multer = require('multer');

const PROVIDER = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();

// ─── Cloudinary helpers ───────────────────────────────────────────────────────

function uploadToCloudinary(buffer, options = {}) {
  const cloudinary = require('../config/cloudinary');
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      })
      .end(buffer);
  });
}

function cloudinaryPublicIdFromUrl(url) {
  // e.g. https://res.cloudinary.com/cloud/image/upload/v123/folder/id.jpg → "folder/id"
  try {
    const urlPath   = new URL(url).pathname;
    const parts     = urlPath.split('/');
    const uploadIdx = parts.findIndex((p) => p === 'upload');
    if (uploadIdx < 0) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    const startIdx    = afterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
    return afterUpload
      .slice(startIdx)
      .join('/')
      .replace(/\.[^.]+$/, ''); // strip extension
  } catch {
    return null;
  }
}

function cloudinaryResourceType(url) {
  if (url.includes('/video/upload/')) return 'video';
  if (url.includes('/raw/upload/'))   return 'raw';
  return 'image';
}

// ─── Local disk provider (development) ───────────────────────────────────────

const localProvider = {
  multerStorage(folder = '') {
    const dir = path.join(__dirname, '../../uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    return multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      },
    });
  },

  async uploadFile(file, folder = '') {
    const filename = path.basename(file.path);
    return folder ? `/uploads/${folder}/${filename}` : `/uploads/${filename}`;
  },

  async deleteFile(publicUrl) {
    if (!publicUrl || publicUrl.startsWith('http')) return;
    const relative = publicUrl.replace(/^\//, '');
    const absolute = path.join(__dirname, '../../', relative);
    if (fs.existsSync(absolute)) fs.unlink(absolute, () => {});
  },

  getPublicUrl(storedValue) {
    if (!storedValue) return null;
    if (storedValue.startsWith('http')) return storedValue;

    if (process.env.BASE_URL) {
      return `${process.env.BASE_URL.replace(/\/$/, '')}${storedValue}`;
    }

    // No BASE_URL configured. In production this would build an unreachable
    // localhost URL for physical devices, so surface the raw stored path
    // instead of fabricating one — and warn loudly so it gets fixed.
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Storage] BASE_URL is not set in production — returning raw path for', storedValue);
      return storedValue;
    }

    return `http://localhost:${process.env.PORT ?? 5000}${storedValue}`;
  },
};

// ─── Cloudinary provider (production) ────────────────────────────────────────

const cloudinaryProvider = {
  multerStorage() {
    return multer.memoryStorage();
  },

  async uploadFile(file, folder = 'messcast/uploads') {
    const result = await uploadToCloudinary(file.buffer, {
      folder,
      resource_type: 'auto',
      public_id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    });
    return result.secure_url; // full HTTPS URL stored directly in MongoDB
  },

  async deleteFile(publicUrl) {
    if (!publicUrl || !publicUrl.includes('cloudinary.com')) return;
    const publicId = cloudinaryPublicIdFromUrl(publicUrl);
    if (!publicId) return;
    try {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(publicId, {
        resource_type: cloudinaryResourceType(publicUrl),
      });
    } catch (err) {
      console.warn('[Storage] Cloudinary delete failed:', err.message);
    }
  },

  getPublicUrl(storedValue) {
    return storedValue ?? null; // Cloudinary URLs are already full HTTPS URLs
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const providers = { local: localProvider, cloudinary: cloudinaryProvider };
const storage   = providers[PROVIDER] ?? localProvider;

if (!providers[PROVIDER]) {
  console.warn(`[Storage] Unknown STORAGE_PROVIDER="${PROVIDER}", falling back to local disk.`);
}

console.log(`[Storage] Provider: ${PROVIDER}`);
module.exports = storage;
