/**
 * 2Factor.in OTP service — AUTOGEN flow.
 *
 * Send:   GET /API/V1/{key}/SMS/{mobile}/AUTOGEN
 *         Response: { Status:"Success", Details:"<sessionId>" }
 *
 * Verify: GET /API/V1/{key}/SMS/VERIFY/{sessionId}/{otp}
 *         Response: { Status:"Success", Details:"OTP Matched" }
 *                or { Status:"Error",   Details:"OTP Mismatch" }
 *
 * 2Factor owns OTP generation and delivery. We store only the sessionId
 * returned at send time and pass the user-entered code to the VERIFY endpoint.
 *
 * Env vars:
 *   TWOFACTOR_API_KEY  — from https://2factor.in → Dashboard → API
 */

const axios = require('axios');

const API_KEY = process.env.TWOFACTOR_API_KEY;

if (!API_KEY) {
  console.error('\x1b[31m[2Factor] TWOFACTOR_API_KEY not set — OTP sending will fail\x1b[0m');
} else {
  console.log('[2Factor] API key loaded ✓');
}

/**
 * Sends OTP via 2Factor.in AUTOGEN. 2Factor generates and delivers the OTP.
 *
 * @param {string} phone  E.164 Indian number, e.g. +916305784704
 * @returns {Promise<{ sessionId: string }>}
 */
async function sendOtp(phone) {
  const mobile = phone.replace(/^\+91/, '').replace(/^91/, '');

  if (!API_KEY) {
    throw Object.assign(
      new Error('SMS service not configured — set TWOFACTOR_API_KEY in backend/.env'),
      { code: 'CONFIG_MISSING' }
    );
  }

  console.log(`[2Factor] Sending AUTOGEN OTP to +91${mobile}`);

  let response;
  try {
    response = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/${mobile}/AUTOGEN`,
      { timeout: 10_000 }
    );
  } catch (axiosErr) {
    const status = axiosErr.response?.status;
    const body   = axiosErr.response?.data;

    if (status === 401 || status === 403) {
      console.error('[2Factor] Auth error — check TWOFACTOR_API_KEY');
      throw Object.assign(new Error('Invalid 2Factor API key'), { code: 'SMS_AUTH_FAILED' });
    }
    if (status === 429) {
      console.error('[2Factor] Rate limit hit');
      throw Object.assign(new Error('SMS rate limit exceeded. Please wait before retrying.'), { code: 'SMS_RATE_LIMIT' });
    }

    console.error('[2Factor] HTTP error:', status, body);
    throw Object.assign(new Error('SMS provider unavailable. Please try again.'), { code: 'SMS_UNAVAILABLE' });
  }

  const data = response.data;
  console.log('[2Factor] Send response:', JSON.stringify(data));

  if (data?.Status !== 'Success') {
    const msg = data?.Details ?? 'Failed to send OTP';
    console.error('[2Factor] Non-success:', msg);
    throw Object.assign(new Error(msg), { code: 'SMS_FAILED' });
  }

  const sessionId = data.Details;
  console.log('[2Factor] OTP dispatched ✓  Session ID:', sessionId);
  return { sessionId };
}

/**
 * Verifies the user-entered OTP against the 2Factor session.
 *
 * @param {string} sessionId  Returned by sendOtp()
 * @param {string} userCode   6-digit code entered by the user
 * @returns {Promise<boolean>}
 */
async function verifyOtp(sessionId, userCode) {
  if (!API_KEY) {
    throw Object.assign(
      new Error('SMS service not configured — set TWOFACTOR_API_KEY in backend/.env'),
      { code: 'CONFIG_MISSING' }
    );
  }

  const code = String(userCode).trim();

  let response;
  try {
    response = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/VERIFY/${sessionId}/${code}`,
      { timeout: 10_000 }
    );
  } catch (axiosErr) {
    console.error('[2Factor] Verify HTTP error:', axiosErr.response?.status, axiosErr.response?.data);
    throw Object.assign(
      new Error('OTP verification service unavailable. Please try again.'),
      { code: 'SMS_UNAVAILABLE' }
    );
  }

  const data = response.data;
  console.log('[2Factor] Verify response:', JSON.stringify(data));
  return data?.Status === 'Success';
}

module.exports = { sendOtp, verifyOtp };
