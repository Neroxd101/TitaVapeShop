const express = require('express');
const path = require('path');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { supabase } = require('../../database/supabase');

/**
 * GET /forgot-password - Serve forgot password page
 */
router.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/forgot-password/forgot-password.html'));
});

/**
 * POST /api/password-reset/request
 * Request password reset - generates OTP and sends email
 */
router.post('/api/password-reset/request', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    // Generate OTP via RPC
    const { data: otpData, error: rpcError } = await supabase.rpc('password_reset_generate_otp', {
      p_username: username
    });

    if (rpcError || !otpData || !otpData.success) {
      const errorMessage = rpcError?.message || otpData?.error || 'Failed to generate OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Send OTP via email (OTP code is in otpData, server-side only)
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: `"Tita Vape Shop" <${process.env.SMTP_USER}>`,
        to: otpData.email,
        subject: 'Password Reset OTP - Tita Vape Shop',
        html: generateOTPEmail(otpData.otp_code)
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Still return success to prevent username enumeration
      // But log the error for debugging
    }

    // Return success (don't expose OTP in response for security)
    res.json({
      success: true,
      message: 'If the username exists, an OTP has been sent to the registered email address.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/password-reset/verify
 * Verify OTP code
 */
router.post('/api/password-reset/verify', async (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({ success: false, error: 'Username and OTP are required' });
    }

    // Verify OTP via RPC
    const { data: verifyData, error: rpcError } = await supabase.rpc('password_reset_verify_otp', {
      p_username: username,
      p_otp_code: otp
    });

    if (rpcError || !verifyData || !verifyData.success) {
      const errorMessage = rpcError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      token_id: verifyData.token_id,
      user_id: verifyData.user_id,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/password-reset/reset
 * Reset password after OTP verification
 */
router.post('/api/password-reset/reset', async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    if (!user_id || !new_password) {
      return res.status(400).json({ success: false, error: 'User ID and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(new_password, saltRounds);

    // Update password via RPC
    const { data: updateData, error: rpcError } = await supabase.rpc('password_reset_update_password', {
      p_user_id: user_id,
      p_new_password_hash: hashedPassword
    });

    if (rpcError || !updateData || !updateData.success) {
      const errorMessage = rpcError?.message || updateData?.error || 'Failed to reset password';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Generate OTP email HTML
 */
function generateOTPEmail(otpCode) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #12121a; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #12121a, #1a1a24); padding: 35px 30px; text-align: center; border-bottom: 1px solid #2a2a3a;">
                  <h1 style="margin: 0; color: #00d4aa; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA VAPE SHOP</h1>
                  <p style="margin: 6px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Password Reset</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 22px; font-weight: 600; font-family: 'Outfit', sans-serif;">Password Reset Request</h2>
                  <p style="margin: 0 0 24px; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                    You have requested to reset your password. Use the OTP code below to verify your identity:
                  </p>
                  
                  <!-- OTP Code Box -->
                  <div style="background-color: #1a1a24; border: 2px solid #00d4aa; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0 0 12px; color: #8b8b9e; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                    <div style="background-color: #12121a; border: 1px dashed #00d4aa; border-radius: 8px; padding: 12px 24px; display: inline-block;">
                      <p style="margin: 0; color: #00d4aa; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otpCode}</p>
                    </div>
                  </div>
                  
                  <p style="margin: 24px 0 0; color: #8b8b9e; font-size: 14px; line-height: 1.6;">
                    This code will expire in <strong style="color: #ffffff;">15 minutes</strong>. If you didn't request this, please ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a24; padding: 24px 30px; text-align: center; border-top: 1px solid #2a2a3a;">
                  <p style="margin: 0; color: #8b8b9e; font-size: 12px;">This is an automated email from Tita Vape Shop</p>
                  <p style="margin: 6px 0 0; color: #ff4757; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Do not share this OTP with anyone</p>
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

module.exports = router;
