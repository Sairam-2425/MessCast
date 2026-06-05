const path  = require('path');
const admin = require('firebase-admin');

// Safety net: load .env relative to this file so Firebase vars are always available
// even if server.js dotenv runs from a different CWD.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Read and normalize the private key once at module load time.
// dotenv v16 with double-quoted values expands \n → real newlines automatically.
// The replace below handles the fallback case where they are still literal \n.
const _projectId   = process.env.FIREBASE_PROJECT_ID   ?? '';
const _clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? '';
const _privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const _configured = Boolean(_projectId && _clientEmail && _privateKey);

if (!_configured) {
  console.error(
    '\x1b[31m[Firebase Admin] MISSING credentials — phone auth will fail.\n' +
    '  Set in backend/.env:\n' +
    '    FIREBASE_PROJECT_ID\n' +
    '    FIREBASE_CLIENT_EMAIL\n' +
    '    FIREBASE_PRIVATE_KEY\x1b[0m'
  );
} else {
  // Initialize once at startup — never called twice thanks to apps.length guard
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   _projectId,
        clientEmail: _clientEmail,
        privateKey:  _privateKey,
      }),
    });
    console.log(`[Firebase Admin] Initialized — project=${_projectId}`);
  }
}

/**
 * Verifies a Firebase ID token issued after phone OTP confirmation.
 * Throws { status: 503, message } when credentials are missing,
 * so the global error handler returns a clean JSON response.
 *
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken>}
 */
async function verifyFirebaseToken(idToken) {
  if (!_configured) {
    const err = new Error('Firebase Admin is not configured on this server');
    err.status = 503;
    throw err;
  }
  return admin.auth().verifyIdToken(idToken);
}

function logFirebaseConfig() {
  console.log(
    `[Firebase Admin] project=${_projectId || '(not set)'} | ` +
    `email=${(_clientEmail || '').split('@')[0]}@... | ` +
    `privateKey=${_privateKey ? 'SET' : 'MISSING'}`
  );
}

module.exports = { verifyFirebaseToken, logFirebaseConfig };
