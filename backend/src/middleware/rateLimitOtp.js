const OtpCode = require('../models/OtpCode');

/**
 * Allow max 3 OTP requests per phone per purpose per hour.
 * Prevents SMS bombing without needing Redis.
 */
const rateLimitOtp = async (req, res, next) => {
  try {
    const { phone, purpose } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await OtpCode.countDocuments({
      phone,
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (count >= 3) {
      return res.status(429).json({
        error: 'Too many OTP requests. Please wait 1 hour before trying again.',
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = rateLimitOtp;
