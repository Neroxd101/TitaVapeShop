const nodemailer = require('nodemailer');

/**
 * Generate 6-digit verification code
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate Customer Verification Email HTML
 */
function generateVerificationEmail(code, fullName) {
  const name = fullName ? fullName.split(' ')[0] : 'Customer';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); max-width: 100%;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #12121a, #1a1a24); padding: 35px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                  <h1 style="margin: 0; color: #00d4aa; font-size: 26px; font-weight: 700; letter-spacing: 1px;">TITA'S VAPE SHOP</h1>
                  <p style="margin: 6px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Email Verification</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 35px 30px;">
                  <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600;">Welcome, ${name}!</h2>
                  <p style="margin: 0 0 24px; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                    Thank you for creating an account with Tita's Vape Shop. To complete your registration and place orders, please enter this verification code:
                  </p>
                  
                  <!-- OTP Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; background-color: #1a1a24; border: 2px solid #00d4aa; border-radius: 12px; padding: 18px 36px; letter-spacing: 10px; font-size: 32px; font-weight: 700; color: #00d4aa; font-family: monospace;">
                          ${code}
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Security Notice -->
                  <div style="background-color: rgba(0, 212, 170, 0.05); border-left: 3px solid #00d4aa; padding: 14px 16px; border-radius: 6px; margin: 24px 0;">
                    <p style="margin: 0; color: #8b8b9e; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #ffffff;">Security Notice:</strong> This code expires in 15 minutes. If you did not create an account at Tita's Vape Shop, please ignore this email.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0d0d14; padding: 20px 30px; text-align: center; border-top: 1px solid #2a2a3a;">
                  <p style="margin: 0; color: #8b8b9e; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Tita's Vape Shop. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate Customer Password Reset Email HTML
 */
function generatePasswordResetEmail(code, fullName) {
  const name = fullName ? fullName.split(' ')[0] : 'Customer';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); max-width: 100%;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #12121a, #1a1a24); padding: 35px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                  <h1 style="margin: 0; color: #00d4aa; font-size: 26px; font-weight: 700; letter-spacing: 1px;">TITA'S VAPE SHOP</h1>
                  <p style="margin: 6px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Password Reset Request</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 35px 30px;">
                  <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600;">Hello, ${name}!</h2>
                  <p style="margin: 0 0 24px; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                    We received a request to reset your password for your Tita's Vape Shop customer account. Use the 6-digit code below to complete your reset:
                  </p>
                  
                  <!-- OTP Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; background-color: #1a1a24; border: 2px solid #00d4aa; border-radius: 12px; padding: 18px 36px; letter-spacing: 10px; font-size: 32px; font-weight: 700; color: #00d4aa; font-family: monospace;">
                          ${code}
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Security Notice -->
                  <div style="background-color: rgba(255, 107, 107, 0.08); border-left: 3px solid #ff6b6b; padding: 14px 16px; border-radius: 6px; margin: 24px 0;">
                    <p style="margin: 0; color: #8b8b9e; font-size: 13px; line-height: 1.5;">
                      <strong style="color: #ff6b6b;">Security Alert:</strong> This code is valid for 15 minutes. If you did not request a password reset, please ignore this email or contact store support immediately.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0d0d14; padding: 20px 30px; text-align: center; border-top: 1px solid #2a2a3a;">
                  <p style="margin: 0; color: #8b8b9e; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Tita's Vape Shop. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send email helper
 */
async function sendMail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Customer Auth] SMTP credentials not set, email skipped in development.');
    return { success: false, error: 'SMTP credentials not configured' };
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return await transporter.sendMail({
    from: `"Tita's Vape Shop" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = {
  generateCode,
  generateVerificationEmail,
  generatePasswordResetEmail,
  sendMail
};
