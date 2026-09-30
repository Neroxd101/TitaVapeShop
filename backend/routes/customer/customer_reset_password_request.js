const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');
const { generateCode, generatePasswordResetEmail, sendMail } = require('./customer_mailer');

router.post('/api/customer/forgot-password', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const otpCode = generateCode();

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('customer_reset_password_request', {
      p_email: cleanEmail,
      p_otp_code: otpCode
    });

    if (rpcError) {
      console.error('[Customer Reset Password] Request RPC error:', rpcError);
      return res.status(500).json({ success: false, error: 'Unable to process password reset request. Please try again.' });
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const customerFound = row && row.success;
    const targetName = row?.full_name || 'Customer';

    // Dispatch email if customer was found
    if (customerFound) {
      try {
        const emailHtml = generatePasswordResetEmail(otpCode, targetName);
        await sendMail(cleanEmail, 'Reset Your Password - Tita\'s Vape Shop', emailHtml);
      } catch (mailErr) {
        console.error('[Customer Reset Password] Email send error:', mailErr);
        return res.status(500).json({
          success: false,
          error: 'Failed to send password reset email. Please try again later.'
        });
      }
    }

    // Generic safe response to prevent email enumeration
    return res.json({
      success: true,
      message: 'If an account exists with this email, a 6-digit password reset code has been sent.'
    });
  } catch (err) {
    console.error('[Customer Reset Password] Error:', err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred. Please try again.' });
  }
});

module.exports = router;
