const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

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
    const { data: verifyData, error: rpcError } = await verifyProfileOtp(userId, otp);

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

// Updates verify and consume the OTP on the server before changing profile data.
function verifyProfileOtp(userId, otp) {
  return supabaseAdmin.rpc('user_profile_verify_otp', {
    p_user_id: userId,
    p_otp_code: otp
  });
}

module.exports = router;
module.exports.verifyProfileOtp = verifyProfileOtp;
