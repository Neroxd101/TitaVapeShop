const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateCode, generateVerificationEmail, sendMail } = require('./customer_mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/resend-otp
 * Generate and dispatch a new 6-digit OTP code
 * Matches RPC: customer_generate_otp
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
    let targetName = 'Customer';

    // 1. If user is currently authenticated (e.g. changing email)
    const token = req.cookies.customer_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          targetUserId = decoded.id;
          targetName = decoded.full_name || 'Customer';
        }
      } catch (_) {}
    }

    // 2. If not authenticated, lookup in customers table or pending verification codes
    if (!targetUserId) {
      const { data: customer } = await client
        .from('customers')
        .select('id, email, full_name, is_verified')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (customer) {
        if (customer.is_verified) {
          return res.status(400).json({ success: false, error: 'This account is already verified. You can log in.' });
        }
        targetUserId = customer.id;
        targetName = customer.full_name || 'Customer';
      } else {
        // Check for pending email change OTP
        const { data: pendingOtp } = await client
          .from('customer_verification_codes')
          .select('customer_id, user_id, email')
          .ilike('email', cleanEmail)
          .eq('verified', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingOtp) {
          targetUserId = pendingOtp.customer_id || pendingOtp.user_id;
          const { data: c } = await client.from('customers').select('full_name').eq('id', targetUserId).maybeSingle();
          if (c) targetName = c.full_name || 'Customer';
        }
      }
    }

    if (!targetUserId) {
      return res.status(404).json({ success: false, error: 'No account or pending verification found with this email address.' });
    }

    // 1. Attempt customer_generate_otp RPC
    let otpCode = null;
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('customer_generate_otp', {
        p_email: cleanEmail,
        p_customer_id: targetUserId
      });

      if (!rpcError && rpcResult && rpcResult.success) {
        otpCode = rpcResult.otp_code;
        if (rpcResult.full_name) targetName = rpcResult.full_name;
      } else if (rpcResult && rpcResult.error) {
        return res.status(400).json({ success: false, error: rpcResult.error });
      }
    } catch (_) {}

    // 2. Direct fallback if RPC is not yet applied
    if (!otpCode) {
      otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: insertError } = await client
        .from('customer_verification_codes')
        .insert({
          customer_id: targetUserId,
          user_id: targetUserId,
          email: cleanEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
          verified: false
        });

      if (insertError) {
        console.error('[Customer Resend] Insert error:', insertError);
        return res.status(500).json({ success: false, error: 'Failed to generate new code.' });
      }
    }

    try {
      await sendMail(
        cleanEmail,
        'Your New Verification Code - Tita\'s Vape Shop',
        generateVerificationEmail(otpCode, targetName)
      );
    } catch (mailErr) {
      console.error('[Customer Resend] Mail error:', mailErr);
    }

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (err) {
    console.error('[Customer Resend] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
