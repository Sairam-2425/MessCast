const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const OtpCode  = require('../models/OtpCode');
const checkSettings  = require('../middleware/checkSettings');
const rateLimitOtp   = require('../middleware/rateLimitOtp');
const { sendPasswordResetEmail }       = require('../utils/mailer');
const { verifyFirebaseToken }          = require('../utils/firebaseAdmin');

// ── OTP provider (controlled by OTP_PROVIDER env var) ─────────────────────────
// OTP_PROVIDER=twofactor  → use 2Factor.in (current active mode)
// OTP_PROVIDER=firebase   → mobile handles OTP natively via Firebase SDK;
//                           /send-otp and /verify-otp routes are disabled
const OTP_PROVIDER = (process.env.OTP_PROVIDER ?? 'twofactor').toLowerCase();
const twofactorOtp = OTP_PROVIDER === 'twofactor' ? require('../services/twofactorOtp') : null;
console.log(`[Auth] OTP_PROVIDER=${OTP_PROVIDER}`);

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    {
      id:          user._id,
      role:        user.role,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
      email:       user.email ?? null,
      phone:       user.phone ?? null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function userPayload(user) {
  return {
    id:          user._id,
    role:        user.role,
    displayName: user.displayName,
    avatarUrl:   user.avatarUrl,
    email:       user.email ?? null,
    phone:       user.phone ?? null,
  };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Indian mobile numbers only: +91 followed by 10 digits starting with 6–9 */
function isValidIndianPhone(phone) {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

// ─── Email Auth (unchanged) ───────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', checkSettings('registrationEnabled'), async (req, res, next) => {
  try {
    const { displayName, email, password } = req.body;
    if (!displayName || !displayName.trim()) return res.status(400).json({ error: 'Display name is required' });
    if (!email || !validateEmail(email))      return res.status(400).json({ error: 'Valid email is required' });
    if (!password || password.length < 8)     return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ displayName: displayName.trim(), email: email.toLowerCase(), password: hashed });
    res.status(201).json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !email.trim())
      return res.status(400).json({ error: 'Email is required' });
    if (!password || typeof password !== 'string')
      return res.status(400).json({ error: 'Password is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user)       return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBanned) return res.status(403).json({ error: 'Your account has been suspended' });
    if (!user.password) return res.status(401).json({ error: 'Account has no password. Contact an admin.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password  (email — sends reset link)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !validateEmail(email.trim()))
      return res.status(400).json({ error: 'A valid email address is required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const resetToken = jwt.sign(
        { id: user._id.toString(), purpose: 'password-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const scheme    = process.env.APP_SCHEME || 'messcast';
      const resetLink = `${scheme}://reset-password?token=${encodeURIComponent(resetToken)}`;
      try {
        await sendPasswordResetEmail(user.email, resetLink);
        console.log(`[forgot-password] Reset email sent to ${user.email}`);
      } catch (emailErr) {
        console.error('[forgot-password] Email send failed:', emailErr.message);
      }
    }
    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password  (email — uses JWT from reset link)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token) return res.status(400).json({ error: 'Reset token is required.' });
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    let payload;
    try { payload = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(400).json({ error: 'This reset link is invalid or has expired.' }); }

    if (payload.purpose !== 'password-reset')
      return res.status(400).json({ error: 'Invalid reset token.' });

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    await User.findByIdAndUpdate(user._id, { password: await bcrypt.hash(newPassword, 12) });
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) { next(err); }
});

// ─── Phone Auth — Fast2SMS OTP ───────────────────────────────────────────────
//
// Flow (no Firebase, no paid plan needed):
//   1. send-otp     → Fast2SMS sends SMS, OTP stored hashed in OtpCode collection
//   2. verify-otp   → validates code, returns short-lived verificationToken JWT
//   3. phone-register / phone-login / forgot-password/verify
//                   → consume verificationToken, return full-session JWT
//
// All OTP codes are bcrypt-hashed before storage.
// Max 3 OTP requests per phone per purpose per hour (rateLimitOtp middleware).
// Max 5 wrong attempts before OTP is invalidated.

/**
 * POST /api/auth/send-otp
 * Body: { phone, purpose: 'register' | 'login' | 'forgot_password' }
 *
 * Active when OTP_PROVIDER=twofactor.
 * When OTP_PROVIDER=firebase the mobile handles OTP natively — this route returns 503.
 */
router.post('/send-otp', rateLimitOtp, async (req, res, next) => {
  // ── Feature flag guard ────────────────────────────────────────────────────
  if (OTP_PROVIDER !== 'twofactor') {
    return res.status(503).json({
      error: 'OTP_PROVIDER is set to firebase — use signInWithPhoneNumber() on the mobile app.',
    });
  }

  try {
    const { phone, purpose } = req.body;

    if (!phone || !isValidIndianPhone(phone))
      return res.status(400).json({ error: 'Enter a valid Indian number: +916305784704' });
    // 'login' no longer uses OTP — phone login is password-based
    if (!['register', 'forgot_password'].includes(purpose))
      return res.status(400).json({ error: 'Invalid purpose. OTP is only used for signup and forgot-password.' });

    const existingUser = await User.findOne({ phone });

    if (purpose === 'register' && existingUser)
      return res.status(409).json({ error: 'This phone number is already registered' });

    if (purpose === 'forgot_password' && !existingUser)
      return res.status(404).json({ error: 'No account found with this phone number' });

    if (existingUser?.isBanned)
      return res.status(403).json({ error: 'Your account has been suspended' });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL

    let sessionId;
    try {
      ({ sessionId } = await twofactorOtp.sendOtp(phone));
      console.log(`[send-otp] 2Factor OTP sent to ${phone} (purpose: ${purpose})`);
    } catch (smsErr) {
      console.error('[send-otp] 2Factor error:', smsErr.code ?? '', smsErr.message);
      return res.status(502).json({
        error: 'Failed to send SMS. Check your phone number and try again.',
      });
    }

    await OtpCode.deleteMany({ phone, purpose, isUsed: false });
    await OtpCode.create({ phone, sessionId, purpose, expiresAt });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code, purpose }
 * Returns: { verificationToken } — short-lived JWT (15 min)
 *
 * Active when OTP_PROVIDER=twofactor.
 */
router.post('/verify-otp', async (req, res, next) => {
  if (OTP_PROVIDER !== 'twofactor') {
    return res.status(503).json({
      error: 'OTP_PROVIDER is set to firebase — use confirmationResult.confirm() on the mobile app.',
    });
  }

  try {
    const { phone, code, purpose } = req.body;

    if (!phone || !code || !purpose)
      return res.status(400).json({ error: 'phone, code and purpose are required' });

    if (!['register', 'forgot_password'].includes(purpose))
      return res.status(400).json({ error: 'Invalid purpose' });

    const record = await OtpCode.findOne({
      phone, purpose, isUsed: false, expiresAt: { $gt: new Date() },
    });

    if (!record)
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });

    record.attempts += 1;

    if (record.attempts > 5) {
      record.isUsed = true;
      await record.save();
      return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
    }

    let isMatch;
    try {
      isMatch = await twofactorOtp.verifyOtp(record.sessionId, code);
    } catch (verifyErr) {
      console.error('[verify-otp] 2Factor verify error:', verifyErr.message);
      await record.save();
      return res.status(502).json({ error: 'OTP verification failed. Please try again.' });
    }

    if (!isMatch) {
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    record.isUsed = true;
    await record.save();

    const verificationToken = jwt.sign(
      { phone, purpose, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'OTP verified', verificationToken });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/phone-register
 * Body: { phone, displayName, email?, password, verificationToken }
 *
 * OTP verification is required ONCE at signup to prove phone ownership.
 * After this, login is password-based — no OTP needed.
 */
router.post('/phone-register', checkSettings('registrationEnabled'), async (req, res, next) => {
  try {
    const { phone, displayName, email, password, verificationToken } = req.body;

    if (!phone || !displayName || !password || !verificationToken)
      return res.status(400).json({ error: 'phone, displayName, password and verificationToken are required' });
    if (displayName.trim().length < 2)
      return res.status(400).json({ error: 'Display name must be at least 2 characters' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (email && !validateEmail(email))
      return res.status(400).json({ error: 'Invalid email address' });

    let decoded;
    try { decoded = jwt.verify(verificationToken, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Verification token expired. Please verify OTP again.' }); }

    if (decoded.phone !== phone || decoded.purpose !== 'register' || !decoded.verified)
      return res.status(401).json({ error: 'Invalid verification token' });

    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone number is already registered' });

    if (email) {
      const emailTaken = await User.findOne({ email: email.toLowerCase() });
      if (emailTaken) return res.status(409).json({ error: 'Email address is already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      displayName:     displayName.trim(),
      phone,
      email:           email ? email.toLowerCase() : null,
      password:        hashedPassword,
      isPhoneVerified: true,
    });

    console.log(`[phone-register] Account created for ${phone}`);
    res.status(201).json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/phone-login
 * Body: { phone, password }
 *
 * Password-based login — NO OTP. OTP was verified once at signup.
 */
router.post('/phone-login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !isValidIndianPhone(phone))
      return res.status(400).json({ error: 'A valid phone number is required' });
    if (!password || typeof password !== 'string')
      return res.status(400).json({ error: 'Password is required' });

    const user = await User.findOne({ phone });
    if (!user)          return res.status(401).json({ error: 'Invalid phone number or password' });
    if (user.isBanned)  return res.status(403).json({ error: 'Your account has been suspended' });
    if (!user.password) return res.status(401).json({ error: 'No password set. Use forgot password to set one.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid phone number or password' });

    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/forgot-password/verify
 * Body: { phone, verificationToken }
 * Verifies OTP for forgot-password flow → issues a short-lived resetToken.
 */
router.post('/forgot-password/verify', async (req, res, next) => {
  try {
    const { phone, verificationToken } = req.body;

    if (!phone || !verificationToken)
      return res.status(400).json({ error: 'phone and verificationToken are required' });

    let decoded;
    try { decoded = jwt.verify(verificationToken, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Verification token expired. Please verify OTP again.' }); }

    if (decoded.phone !== phone || decoded.purpose !== 'forgot_password' || !decoded.verified)
      return res.status(401).json({ error: 'Invalid verification token' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'No account found with this phone number' });

    const resetToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'phone_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'Verified', resetToken });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/reset-password-phone
 * Body: { resetToken, newPassword }
 * Sets a new password after phone OTP verification.
 */
router.post('/reset-password-phone', async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken)
      return res.status(400).json({ error: 'resetToken is required' });
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    let decoded;
    try { decoded = jwt.verify(resetToken, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Reset token expired. Please start the process again.' }); }

    if (decoded.purpose !== 'phone_reset')
      return res.status(401).json({ error: 'Invalid reset token' });

    await User.findByIdAndUpdate(decoded.userId, { password: await bcrypt.hash(newPassword, 12) });
    console.log(`[reset-password-phone] Password updated for user ${decoded.userId}`);
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) { next(err); }
});

// ─── Firebase Phone Auth ──────────────────────────────────────────────────────
//
// Flow:
//   1. Mobile calls signInWithPhoneNumber() — Firebase sends SMS (free).
//   2. User enters OTP → confirmationResult.confirm(otp) → Firebase returns credential.
//   3. Mobile calls credential.user.getIdToken() and sends idToken here.
//   4. We verify the token with Firebase Admin, extract phone_number, and issue our JWT.

/**
 * POST /api/auth/firebase-phone-login
 * Body: { idToken }
 */
router.post('/firebase-phone-login', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    const decoded = await verifyFirebaseToken(idToken);
    const phone   = decoded.phone_number;
    if (!phone) return res.status(400).json({ error: 'Invalid Firebase token: no phone number claim' });

    const user = await User.findOne({ phone });
    if (!user)        return res.status(404).json({ error: 'No account found. Please register first.' });
    if (user.isBanned) return res.status(403).json({ error: 'Your account has been suspended' });

    res.json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/firebase-phone-register
 * Body: { idToken, displayName }
 */
router.post('/firebase-phone-register', checkSettings('registrationEnabled'), async (req, res, next) => {
  try {
    const { idToken, displayName } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });
    if (!displayName || displayName.trim().length < 2)
      return res.status(400).json({ error: 'Display name must be at least 2 characters' });

    const decoded = await verifyFirebaseToken(idToken);
    const phone   = decoded.phone_number;
    if (!phone) return res.status(400).json({ error: 'Invalid Firebase token: no phone number claim' });

    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone number already registered. Please log in instead.' });

    const user = await User.create({ displayName: displayName.trim(), phone, isPhoneVerified: true });

    console.log(`[firebase-phone-register] Account created for ${phone}`);
    res.status(201).json({ token: signToken(user), user: userPayload(user) });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/firebase-phone-forgot
 * Body: { idToken }
 * Verifies phone ownership via Firebase → issues a short-lived resetToken for password reset.
 */
router.post('/firebase-phone-forgot', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    const decoded = await verifyFirebaseToken(idToken);
    const phone   = decoded.phone_number;
    if (!phone) return res.status(400).json({ error: 'Invalid Firebase token: no phone number claim' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'No account found with this phone number' });

    const resetToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'phone_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'Verified', resetToken });
  } catch (err) { next(err); }
});

module.exports = router;
