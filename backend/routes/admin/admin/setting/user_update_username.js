const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { verifyProfileOtp } = require('./user_profile_verify_otp');

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

    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Database service unavailable' });
    }

    if (!new_username || !otp) {
      return res.status(400).json({ success: false, error: 'New username and OTP are required' });
    }

    // Determine target user: admin can update others, regular users update themselves
    const targetUserId = target_user_id || adminUserId;

    // Verify OTP first (always use admin's OTP for verification)
    const { data: verifyData, error: verifyError } = await verifyProfileOtp(adminUserId, otp);

    if (verifyError || !verifyData || !verifyData.success) {
      const errorMessage = verifyError?.message || verifyData?.error || 'Invalid or expired OTP';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    // Update username via RPC
    const { data: updateData, error: rpcError } = await supabaseAdmin.rpc('user_update_username', {
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

module.exports = router;
