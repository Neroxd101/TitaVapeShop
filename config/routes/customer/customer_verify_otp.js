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

    // 1. Attempt customer_verify_otp RPC
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('customer_verify_otp', {
        p_email: cleanEmail,
        p_otp_code: cleanCode
      });

      if (!rpcError && rpcResult && rpcResult.success && rpcResult.customer) {
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
      } else if (rpcResult && rpcResult.error) {
        return res.status(400).json({ success: false, error: rpcResult.error });
      }
    } catch (_) {}

    // 2. Direct fallback if RPC is not yet applied
    const nowIso = new Date().toISOString();
    const { data: codeRows, error: codeQueryError } = await client
      .from('customer_verification_codes')
      .select('id, customer_id, user_id, email, expires_at, verified')
      .eq('email', cleanEmail)
      .eq('otp_code', cleanCode)
      .eq('verified', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeQueryError || !codeRows || codeRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please check your code or request a new one.'
      });
    }

    const matchedOtp = codeRows[0];
    const targetEmail = matchedOtp.email || cleanEmail;

    // Mark OTP as verified
    await client
      .from('customer_verification_codes')
      .update({ verified: true })
      .eq('id', matchedOtp.id);

    const targetCustomerId = matchedOtp.customer_id || matchedOtp.user_id;

    // Mark customer as verified and update email to the verified email
    const { data: updatedCustomer, error: customerUpdateError } = await client
      .from('customers')
      .update({
        email: targetEmail,
        is_verified: true,
        email_verified_at: new Date().toISOString()
      })
      .eq('id', targetCustomerId)
      .select('id, email, full_name, contact_number, birthday')
      .single();

    if (customerUpdateError || !updatedCustomer) {
      console.error('[Customer Verify] Customer update error:', customerUpdateError);
      return res.status(500).json({ success: false, error: 'Failed to update verification status.' });
    }

    // Sign JWT customer session
    const customerPayload = {
      id: updatedCustomer.id,
      email: updatedCustomer.email,
      full_name: updatedCustomer.full_name || '',
      contact_number: updatedCustomer.contact_number || '',
      birthday: updatedCustomer.birthday || null,
      role: 'customer'
    };

    const token = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });

    res.cookie('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.json({
      success: true,
      message: 'Email successfully verified!',
      user: customerPayload
    });
  } catch (err) {
    console.error('[Customer Verify] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
