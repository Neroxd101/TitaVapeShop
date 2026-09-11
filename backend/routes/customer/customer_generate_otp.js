const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateVerificationEmail, sendMail } = require('./customer_mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/resend-otp
 * Generate and dispatch a new 6-digit OTP code via customer_generate_otp RPC
 */
router.post('/api/customer/resend-otp', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    let targetUserId = null;
    const token = req.cookies?.customer_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          targetUserId = decoded.id;
        }
      } catch (_) {}
    }

    // Call customer_generate_otp RPC
    const { data: rpcResult, error: rpcError } = await client.rpc('customer_generate_otp', {
      p_email: cleanEmail,
      p_customer_id: targetUserId
    });

    if (rpcError) {
      console.error('[Customer Generate OTP] RPC Error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Failed to generate code.' });
    }

    if (!rpcResult || !rpcResult.success || !rpcResult.otp_code) {
      return res.status(400).json({
        success: false,
        error: rpcResult?.error || 'Failed to generate verification code.'
      });
    }

    // Dispatch verification email via customer_mailer
    try {
      const emailHtml = generateVerificationEmail(rpcResult.otp_code, rpcResult.full_name);
      await sendMail(cleanEmail, "Verify Your Email - Tita's Vape Shop", emailHtml);
    } catch (mailErr) {
      console.error('[Customer Generate OTP] Email send error:', mailErr);
      return res.status(500).json({
        success: false,
        error: 'Verification code generated, but failed to send email. Please try again.'
      });
    }

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    console.error('[Customer Generate OTP] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
