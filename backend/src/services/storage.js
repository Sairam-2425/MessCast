/**
 * Storage abstraction layer.
 *
 * Current provider: local disk (Express static-served from /uploads).
 *
 * To switch to a cloud provider (Cloudinary, S3, Firebase Storage):
 *   1. Set STORAGE_PROVIDER env var: 'local' | 'cloudinary' | 's3' | 'firebase'
 *   2. Add the provider-specific SDK + config below.
 *   3. Implement the same interface: { uploadFile, deleteFile, getPublicUrl }.
 *
 * All route handlers should use this module instead of touching `fs` directly,
 * so a single implementation change here swaps the provider everywhere.
 */

const path = require('path');
const fs   = require('fs');

const PROVIDER = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();

// ─── Local disk (default) ────────────────────────────────────────────────────

const localProvider = {
  /**
   * "Upload" a file that multer already saved to disk.
   * For local storage this is a no-op — multer writes the file itself.
   * Returns the public URL path that the client can request.
   *
   * @param {string} diskPath  Absolute path where multer wrote the file
   * @param {string} subdir    Sub-directory inside /uploads, e.g. '' | 'avatars'
   * @returns {string}         Public path, e.g. /uploads/avatars/avatar_123.jpg
   */
  async uploadFile(diskPath, subdir = '') {
    const filename = path.basename(diskPath);
    const relative = subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
    return relative;
  },

  /**
   * Delete a file from disk given its public URL path.
   * Silently ignores missing files.
   *
   * @param {string} publicUrl  Path like /uploads/avatars/avatar_123.jpg
   */
  async deleteFile(publicUrl) {
    if (!publicUrl) return;
    const relative = publicUrl.replace(/^\//, '');
    const absolute = path.join(__dirname, '../../', relative);
    if (fs.existsSync(absolute)) {
      fs.unlink(absolute, () => {});
    }
  },

  /**
   * Returns the full public URL for a stored file.
   * For local storage, prepend the server base URL from env.
   *
   * @param {string} publicPath  e.g. /uploads/avatars/avatar_123.jpg
   * @returns {string}           e.g. http://localhost:5000/uploads/avatars/avatar_123.jpg
   */
  getPublicUrl(publicPath) {
    const base = (process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 5000}`).replace(/\/$/, '');
    return `${base}${publicPath}`;
  },
};

// ─── Provider registry ────────────────────────────────────────────────────────
//
// Swap STORAGE_PROVIDER in .env to activate a different provider.
// Each provider must expose: uploadFile(diskPath, subdir), deleteFile(url), getPublicUrl(path).

const providers = {
  local: localProvider,

  // cloudinary: require('./providers/cloudinaryProvider'),
  // s3:         require('./providers/s3Provider'),
  // firebase:   require('./providers/firebaseStorageProvider'),
};

const storage = providers[PROVIDER] ?? localProvider;

if (!providers[PROVIDER]) {
  console.warn(`[Storage] Unknown STORAGE_PROVIDER="${PROVIDER}", falling back to local disk.`);
}

console.log(`[Storage] Provider: ${PROVIDER}`);

module.exports = storage;
