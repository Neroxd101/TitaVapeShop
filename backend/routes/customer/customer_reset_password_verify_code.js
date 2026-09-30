const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');

router.post('/api/customer/verify-reset-code', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email, otp_code } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otp_code || '').trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, error: 'A valid 6-digit verification code is required.' });
    }

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('customer_reset_password_verify_code', {
      p_email: cleanEmail,
      p_otp_code: cleanCode
    });

    if (rpcError) {
      console.error('[Customer Reset Password] Verify code RPC error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Invalid or expired verification code.' });
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row && !row.success) {
      return res.status(400).json({ success: false, error: row.error || 'Invalid or expired verification code.' });
    }

    return res.json({
      success: true,
      message: row?.message || 'Code verified successfully.'
    });
  } catch (err) {
    console.error('[Customer Reset Password] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify code. Please try again.' });
  }
});

module.exports = router;
