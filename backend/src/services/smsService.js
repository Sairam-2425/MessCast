/**
 * SMS service — 2Factor.in (free tier: 100 OTPs on signup, Indian numbers).
 *
 * Setup (one-time):
 *  1. Sign up at https://2factor.in → verify your +91 number
 *  2. Dashboard → API → copy your API Key
 *  3. Add to backend/.env: TWO_FACTOR_API_KEY=<your_key>
 *
 * Flow:
 *  sendOtp(phone)  → 2Factor generates OTP, sends SMS, returns sessionId
 *  verifyOtpWithProvider(sessionId, otp) → 2Factor validates the code
 */

const axios = require('axios');

const API_KEY = process.env.TWO_FACTOR_API_KEY;

console.log('[2Factor] API key loaded:', Boolean(API_KEY));

if (!API_KEY) {
  console.error('\x1b[31m[2Factor] TWO_FACTOR_API_KEY is not set in backend/.env — OTP will fail\x1b[0m');
}

/**
 * Sends an OTP via 2Factor.in.
 * 2Factor generates the code internally — we only get back a sessionId.
 * @param {string} phone  E.164 Indian number, e.g. +916305784704
 * @returns {Promise<string>} sessionId to store and later use for verification
 */
async function sendOtp(phone) {
  if (!API_KEY) {
    throw Object.assign(new Error('TWO_FACTOR_API_KEY is not configured in .env'), { code: 'CONFIG_MISSING' });
  }

  const mobile = phone.replace(/^\+91/, '').replace(/^91/, '');
  console.log('[2Factor] Sending OTP to:', mobile);

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
      console.error('[2Factor] Auth error — check TWO_FACTOR_API_KEY in .env');
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
  console.log('[2Factor] Response:', JSON.stringify(data));

  if (data?.Status !== 'Success') {
    const msg = data?.Details ?? 'Failed to send OTP';
    console.error('[2Factor] Non-success response:', msg);
    throw Object.assign(new Error(msg), { code: 'SMS_FAILED' });
  }

  const sessionId = data.Details;
  console.log('[2Factor] OTP sent. Session ID:', sessionId);
  return sessionId;
}

/**
 * Verifies an OTP with 2Factor.in.
 * @param {string} sessionId  Returned by sendOtp()
 * @param {string} otp        Code entered by the user
 * @returns {Promise<boolean>} true if correct, false if wrong
 */
async function verifyOtpWithProvider(sessionId, otp) {
  if (!API_KEY) {
    throw Object.assign(new Error('TWO_FACTOR_API_KEY is not configured in .env'), { code: 'CONFIG_MISSING' });
  }

  let response;
  try {
    response = await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/SMS/VERIFY/${sessionId}/${otp}`,
      { timeout: 10_000 }
    );
  } catch (axiosErr) {
    const status = axiosErr.response?.status;
    console.error('[2Factor] Verify HTTP error:', status, axiosErr.response?.data);
    throw Object.assign(new Error('OTP verification failed. Please try again.'), { code: 'SMS_UNAVAILABLE' });
  }

  const data = response.data;
  console.log('[2Factor] Verify response:', JSON.stringify(data));
  return data?.Status === 'Success';
}

/**
 * Welcome SMS after registration (non-critical — errors are swallowed).
 * Uses 2Factor transactional route.
 */
async function sendWelcomeSms(phone, displayName) {
  if (!API_KEY) return;
  try {
    const mobile = phone.replace(/^\+91/, '').replace(/^91/, '');
    await axios.get(
      `https://2factor.in/API/V1/${API_KEY}/ADDON_SERVICES/SEND/TSMS`,
      {
        params: {
          From:    'MSSCAST',
          To:      mobile,
          TemplateName: 'welcome',
          VAR1:    displayName,
        },
        timeout: 10_000,
      }
    );
  } catch (err) {
    console.error('[2Factor] Welcome SMS failed (non-critical):', err.message);
  }
}

module.exports = { sendOtp, verifyOtpWithProvider, sendWelcomeSms };
