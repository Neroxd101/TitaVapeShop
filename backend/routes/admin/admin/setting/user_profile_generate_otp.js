const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');

/**
 * POST /api/user/profile/generate-otp
 * Generate OTP for profile changes
 */
router.post('/api/user/profile/generate-otp', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    // Get user ID from JWT (from auth middleware)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Verify current password if provided (for UX validation before sending OTP)
    const { current_password } = req.body || {};
    if (current_password) {
      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
      }

      // Retrieve user's current password hash using supabaseAdmin (bypassing RLS)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error('Error fetching user password for verification:', userError);
        return res.status(400).json({ success: false, error: 'Failed to verify current password' });
      }

      // Check current password with stored bcrypt hash
      const isMatch = await bcrypt.compare(current_password, userData.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect current password' });
      }
    }

    // Generate OTP via RPC
    const { data: otpData, error: rpcError } = await supabaseAdmin.rpc('user_profile_generate_otp', {
      p_user_id: userId,
      p_otp_code: randomInt(100000, 1000000).toString()
    });

    if (rpcError || !otpData || !otpData.success) {
      const errorMessage = rpcError?.message || otpData?.error || 'Failed to generate OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Send OTP via email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: `"Tita\'s Vape Shop" <${process.env.SMTP_USER}>`,
        to: otpData.email,
        subject: 'Profile Update OTP - Tita\'s Vape Shop',
        html: generateProfileOTPEmail(otpData.otp_code)
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Still return success to prevent enumeration
    }

    res.json({
      success: true,
      message: 'OTP has been sent to your email address.'
    });
  } catch (error) {
    console.error('Generate profile OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Generate Profile Update OTP email HTML
 */
function generateProfileOTPEmail(otpCode) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Profile Update OTP</title>
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
                  <h1 style="margin: 0; color: #00d4aa; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA\'S VAPE SHOP</h1>
                  <p style="margin: 6px 0 0; color: #8b8b9e; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">Profile Update Verification</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 22px; font-weight: 600; font-family: 'Outfit', sans-serif;">Profile Update Request</h2>
                  <p style="margin: 0 0 24px; color: #8b8b9e; font-size: 15px; line-height: 1.6;">
                    You have requested to update your profile. Use the OTP code below to verify your identity:
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
                  <p style="margin: 0; color: #8b8b9e; font-size: 12px;">This is an automated email from Tita\'s Vape Shop</p>
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
