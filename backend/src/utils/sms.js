/**
 * SMS utility — Twilio Programmable Messaging for plain (non-OTP) messages.
 *
 * OTP sending and verification is now handled entirely by Firebase Phone Auth
 * on the mobile side. This file is kept only for informational welcome messages.
 *
 * NOTE: Twilio trial accounts can only send to verified numbers. On a trial
 * account the welcome SMS will silently skip if the destination is not verified.
 * Consider replacing with a UI toast if Twilio is not fully set up.
 */

const twilio = require('twilio');

let _client = null;

function getClient() {
  if (_client) return _client;

  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || sid.startsWith('ACxxx') || !auth || auth === 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
    return null; // Twilio not configured — callers must handle null gracefully
  }

  _client = twilio(sid, auth);
  return _client;
}

/**
 * Sends a plain SMS. Returns silently if Twilio is not configured or destination
 * is not verified (trial account limitation).
 */
async function sendSMS(to, body) {
  const client = getClient();
  if (!client) {
    console.warn('[Twilio SMS] Not configured — skipping SMS to', to);
    return;
  }
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from || from === '+1xxxxxxxxxx') {
    console.warn('[Twilio SMS] TWILIO_PHONE_NUMBER not set — skipping');
    return;
  }
  await client.messages.create({ body, from, to });
}

/**
 * Welcome SMS after phone registration. Non-critical — errors logged, not thrown.
 */
async function sendWelcomeSMS(phone, displayName) {
  try {
    await sendSMS(phone, `Welcome to MessCast, ${displayName}! Your account is ready.`);
  } catch (err) {
    console.warn('[Twilio SMS] Welcome SMS failed (non-critical):', err.message);
  }
}

module.exports = { sendSMS, sendWelcomeSMS };
