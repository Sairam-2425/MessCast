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

// Local disk storage can never work on a host with an ephemeral filesystem
// (e.g. Render) — files written there vanish on the next restart/redeploy.
// If STORAGE_PROVIDER isn't explicitly set, default to the only provider that
// actually persists in production rather than silently falling back to local.
const PROVIDER = (
  process.env.STORAGE_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'cloudinary' : 'local')
).toLowerCase();

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
    console.log(`[Storage] Local upload directory ready: ${dir}`);
    return multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        console.log(`[Storage] Saving "${file.originalname}" → ${path.join(dir, name)}`);
        cb(null, name);
      },
    });
  },

  async uploadFile(file) {
    // Build the public path from where multer actually wrote the file —
    // NOT from the `folder` argument, which is a Cloudinary-style folder
    // name (e.g. "messcast/uploads") that doesn't match the disk layout
    // multerStorage() created (e.g. "uploads/<file>"). Using the wrong
    // string here produced URLs that 404 even on the same running instance.
    const uploadsRoot = path.join(__dirname, '../../uploads');
    const relative    = path.relative(uploadsRoot, file.path).split(path.sep).join('/');
    const publicPath  = `/uploads/${relative}`;
    console.log(`[Storage] Saved file path: ${file.path} → public path: ${publicPath}`);
    return publicPath;
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

    let url;
    if (process.env.BASE_URL) {
      url = `${process.env.BASE_URL.replace(/\/$/, '')}${storedValue}`;
    } else if (process.env.NODE_ENV === 'production') {
      // No BASE_URL configured. In production this would build an unreachable
      // localhost URL for physical devices, so surface the raw stored path
      // instead of fabricating one — and warn loudly so it gets fixed.
      console.warn('[Storage] BASE_URL is not set in production — returning raw path for', storedValue);
      return storedValue;
    } else {
      url = `http://localhost:${process.env.PORT ?? 5000}${storedValue}`;
    }

    console.log(`[Storage] Generated public URL: ${storedValue} → ${url}`);
    return url;
  },
};

// ─── Cloudinary provider (production) ────────────────────────────────────────

const cloudinaryProvider = {
  multerStorage() {
    return multer.memoryStorage();
  },

  async uploadFile(file, folder = 'messcast/uploads') {
    // resource_type: 'auto' routes documents (PDF, DOCX, ...) into Cloudinary's
    // "image" delivery type, which the account's default security settings block
    // from public delivery (returns 401 — Cloudinary won't serve PDF/ZIP as images
    // to prevent embedded-script XSS). "raw" delivers the file byte-for-byte with
    // no such restriction, so non-media documents must use it explicitly.
    const resourceType = file.mimetype?.startsWith('image/') ? 'image'
      : file.mimetype?.startsWith('video/') || file.mimetype?.startsWith('audio/') ? 'video'
      : 'raw';

    const publicId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result = await uploadToCloudinary(file.buffer, {
      folder,
      resource_type: resourceType,
      public_id: publicId,
    });
    console.log(`[Storage] Uploaded "${file.originalname}" (${file.mimetype}) → ${result.secure_url} [resource_type=${resourceType}]`);
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
