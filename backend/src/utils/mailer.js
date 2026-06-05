const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter from environment variables.
 * Supports any SMTP provider — Gmail, Outlook, Mailtrap, SendGrid SMTP, etc.
 */
function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      'Email not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in backend/.env'
    );
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a password-reset email containing a deep-link/URL with the JWT token.
 *
 * @param {string} toEmail   - Recipient email address
 * @param {string} resetLink - Full reset URL (deep-link or web URL)
 */
async function sendPasswordResetEmail(toEmail, resetLink) {
  const from = process.env.SMTP_FROM || `MessCast <${process.env.SMTP_USER}>`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Reset Your MessCast Password',
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#13131F;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#7C5CFC;font-size:22px;font-weight:700;letter-spacing:3px;">
                MESSCAST
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#F0F0FF;font-size:24px;">
                Reset Your Password
              </h2>
              <p style="margin:0 0 24px;color:rgba(240,240,255,0.6);font-size:15px;line-height:1.6;">
                We received a request to reset the password for your MessCast account.
                Click the button below to set a new password. This link expires in
                <strong style="color:#F0F0FF;">1 hour</strong>.
              </p>
              <a href="${resetLink}"
                 style="display:inline-block;padding:14px 32px;background:#7C5CFC;color:#FFFFFF;
                        text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
                Reset Password
              </a>
              <p style="margin:28px 0 0;color:rgba(240,240,255,0.4);font-size:12px;line-height:1.6;">
                If the button above doesn't work, copy and paste this link:<br>
                <span style="color:#7C5CFC;word-break:break-all;">${resetLink}</span>
              </p>
              <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(240,240,255,0.35);font-size:12px;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not change.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: `Reset your MessCast password\n\nClick this link (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
  });
}

module.exports = { sendPasswordResetEmail };
