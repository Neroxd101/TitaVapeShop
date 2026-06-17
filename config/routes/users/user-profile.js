const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

/**
 * GET /api/user/profile/info
 * Get current user profile information (or target user if admin)
 */
router.get('/api/user/profile/info', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const targetUserId = req.query.user_id; // Admin can specify target user
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    let user;

    if (targetUserId) {
      // Fetch specific user by ID via RPC
      const { data: userData, error: rpcError } = await supabase.rpc('users_get_all', {
        p_user_id: targetUserId
      });

      if (rpcError || !userData || userData.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      user = userData[0];
    } else {
      // Get current user info via RPC
      const { data: userData, error: rpcError } = await supabase.rpc('user_get_by_username', {
        p_username: req.user.username
      });

      if (rpcError || !userData || userData.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      user = userData[0];
    }

    // Return user info (without password)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        last_login: user.last_login,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/users/list
 * Get list of all users (admin only)
 */
router.get('/api/users/list', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }
    
    // Call RPC function to get all users
    const { data: users, error } = await supabase.rpc('users_get_all');

    if (error) {
      console.error('RPC error fetching users:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

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
      const { supabaseAdmin } = require('../../database/supabase');
      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
      }

      // Retrieve user's current password hash using supabaseAdmin (bypassing RLS)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user password for verification:', userError);
        return res.status(400).json({ success: false, error: 'Failed to verify current password' });
      }

      // Check current password with stored bcrypt hash
      const isMatch = bcrypt.compareSync(current_password, userData.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect current password' });
      }
    }

    // Generate OTP via RPC
    const { data: otpData, error: rpcError } = await supabase.rpc('user_profile_generate_otp', {
      p_user_id: userId
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
        from: `"Tita Vape Shop" <${process.env.SMTP_USER}>`,
        to: otpData.email,
        subject: 'Profile Update OTP - Tita Vape Shop',
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
 * POST /api/user/profile/verify-otp
 * Verify OTP for profile changes
 */
router.post('/api/user/profile/verify-otp', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!otp) {
      return res.status(400).json({ success: false, error: 'OTP is required' });
    }

    // Verify OTP via RPC
    const { data: verifyData, error: rpcError } = await supabase.rpc('user_profile_verify_otp', {
      p_user_id: userId,
      p_otp_code: otp
    });

    if (rpcError || !verifyData || !verifyData.success) {
      const errorMessage = rpcError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify profile OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/user/profile/update-username
 * Update username after OTP verification
 * Admin can update any user by providing target_user_id
 */
router.post('/api/user/profile/update-username', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    const { new_username, otp, target_user_id } = req.body;
    const adminUserId = req.user?.id;

    if (!adminUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!new_username || !otp) {
      return res.status(400).json({ success: false, error: 'New username and OTP are required' });
    }

    // Determine target user: admin can update others, regular users update themselves
    const targetUserId = target_user_id || adminUserId;

    // Verify OTP first (always use admin's OTP for verification)
    const { data: verifyData, error: verifyError } = await supabase.rpc('user_profile_verify_otp', {
      p_user_id: adminUserId,
      p_otp_code: otp
    });

    if (verifyError || !verifyData || !verifyData.success) {
      const errorMessage = verifyError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Update username via RPC
    const { data: updateData, error: rpcError } = await supabase.rpc('user_update_username', {
      p_user_id: targetUserId,
      p_new_username: new_username
    });

    if (rpcError || !updateData || !updateData.success) {
      const errorMessage = rpcError?.message || updateData?.error || 'Failed to update username';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      message: 'Username updated successfully',
      username: new_username
    });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/user/profile/update-password
 * Update password after OTP verification
 * Admin can update any user by providing target_user_id
 */
router.post('/api/user/profile/update-password', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    const { new_password, current_password, otp, target_user_id } = req.body;
    const adminUserId = req.user?.id;

    if (!adminUserId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    if (!new_password || !otp) {
      return res.status(400).json({ success: false, error: 'New password and OTP are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Determine target user: admin can update others, regular users update themselves
    const targetUserId = target_user_id || adminUserId;
    const isSelf = targetUserId === adminUserId;

    if (isSelf) {
      if (!current_password) {
        return res.status(400).json({ success: false, error: 'Current password is required to verify identity' });
      }

      const { supabaseAdmin } = require('../../database/supabase');
      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
      }

      // Retrieve user's current password hash using supabaseAdmin (bypassing RLS)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', adminUserId)
        .single();

      if (userError || !userData) {
        console.error('Error fetching user password for verification:', userError);
        return res.status(400).json({ success: false, error: 'Failed to verify current password' });
      }

      // Check current password with stored bcrypt hash
      const isMatch = bcrypt.compareSync(current_password, userData.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Incorrect current password' });
      }
    }

    // Verify OTP first (always use admin's OTP for verification)
    const { data: verifyData, error: verifyError } = await supabase.rpc('user_profile_verify_otp', {
      p_user_id: adminUserId,
      p_otp_code: otp
    });

    if (verifyError || !verifyData || !verifyData.success) {
      const errorMessage = verifyError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(new_password, saltRounds);

    // Update password via RPC
    const { data: updateData, error: rpcError } = await supabase.rpc('password_reset_update_password', {
      p_user_id: targetUserId,
      p_new_password_hash: hashedPassword
    });

    if (rpcError || !updateData || !updateData.success) {
      const errorMessage = rpcError?.message || updateData?.error || 'Failed to update password';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
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
                  <h1 style="margin: 0; color: #00d4aa; font-size: 28px; font-weight: 700; letter-spacing: 1px; font-family: 'Outfit', sans-serif;">TITA VAPE SHOP</h1>
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
