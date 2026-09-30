const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../database/supabase');

router.post('/api/password-reset/verify', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Password reset service unavailable' });
    }
    const { username, otp } = req.body;

    if (!username || !otp) {
      return res.status(400).json({ success: false, error: 'Username and OTP are required' });
    }

    // Verify OTP via RPC
    const { data: verifyData, error: rpcError } = await supabaseAdmin.rpc('password_reset_verify_otp', {
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
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
