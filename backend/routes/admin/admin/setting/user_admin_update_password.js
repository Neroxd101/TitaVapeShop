const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { verifyProfileOtp } = require('./user_profile_verify_otp');
const bcrypt = require('bcryptjs');

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

    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Database service unavailable' });
    }

    if (!new_password || !otp) {
      return res.status(400).json({ success: false, error: 'New password and OTP are required' });
    }

    if (new_password.length < 8 || new_password.length > 72 ||
        !/[A-Z]/.test(new_password) || !/[a-z]/.test(new_password) ||
        !/[0-9]/.test(new_password) || !/[^A-Za-z0-9]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be 8–72 characters and include uppercase, lowercase, number, and symbol.'
      });
    }

    // Determine target user: admin can update others, regular users update themselves
    const targetUserId = target_user_id || adminUserId;
    const isSelf = targetUserId === adminUserId;

    if (isSelf) {
      if (!current_password) {
        return res.status(400).json({ success: false, error: 'Current password is required to verify identity' });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
      }

      // Retrieve user's current password hash using supabaseAdmin (bypassing RLS)
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('password')
        .eq('id', adminUserId)
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

    // Verify OTP first (always use admin's OTP for verification)
    const { data: verifyData, error: verifyError } = await verifyProfileOtp(adminUserId, otp);

    if (verifyError || !verifyData || !verifyData.success) {
      const errorMessage = verifyError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password via RPC
    const { data: updateData, error: rpcError } = await supabaseAdmin.rpc('user_admin_update_password', {
      p_user_id: targetUserId,
      p_new_password_hash: hashedPassword
    });

    if (rpcError || !updateData || !updateData.success) {
      const errorMessage = rpcError?.message || updateData?.error || 'Failed to update password';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    if (isSelf) {
      res.clearCookie('token');
    }

    res.json({
      success: true,
      message: isSelf
        ? 'Password updated successfully. Please sign in again.'
        : 'Password updated successfully',
      requires_login: isSelf
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
