const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/verify-email
 * Validate 6-digit OTP code, mark verified, and set customer_token session cookie
 * Matches RPC: customer_verify_otp
 */
router.post('/api/customer/verify-email', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!cleanEmail || !cleanCode) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit code are required.' });
    }

    // Call customer_verify_otp RPC
    const { data: rpcResult, error: rpcError } = await client.rpc('customer_verify_otp', {
      p_email: cleanEmail,
      p_otp_code: cleanCode
    });

    if (rpcError) {
      console.error('[Customer Verify OTP] RPC Error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Verification failed.' });
    }

    if (!rpcResult || !rpcResult.success || !rpcResult.customer) {
      return res.status(400).json({
        success: false,
        error: rpcResult?.error || 'Invalid or expired verification code.'
      });
    }

    const customerPayload = rpcResult.customer;
    const token = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: rpcResult.message || 'Email successfully verified!',
      user: customerPayload
    });
  } catch (err) {
    console.error('[Customer Verify OTP] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
