const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateVerificationEmail, sendMail } = require('./customer_mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * PUT /api/customer/profile
 * Update customer profile (full_name, contact_number, email) via customer_update_profile RPC
 */
router.put('/api/customer/profile', async (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Please sign in to update your profile.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.clearCookie('customer_token');
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
  }

  const { full_name, contact_number, email } = req.body;
  const client = dbClient();

  if (!client) {
    return res.status(500).json({ success: false, error: 'Database service unavailable' });
  }

  // Validate full_name
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Please enter a valid full name (at least 2 characters).' });
  }

  // Validate contact_number (Philippine mobile e.g. 09XXXXXXXXX or +639...)
  const phonePattern = /^(09|\+639)\d{9}$/;
  if (!contact_number || !phonePattern.test(contact_number.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid 11-digit mobile number (e.g. 09123456789).' });
  }

  // Validate email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = contact_number.trim();
  const normalizedName = full_name.trim();

  try {
    // Call customer_update_profile RPC
    const { data: rpcResult, error: rpcError } = await client.rpc('customer_update_profile', {
      p_customer_id: decoded.id,
      p_full_name: normalizedName,
      p_contact_number: normalizedPhone,
      p_email: normalizedEmail
    });

    if (rpcError) {
      console.error('[Customer Update Profile] RPC Error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Failed to update profile.' });
    }

    if (!rpcResult || !rpcResult.success) {
      return res.status(400).json({
        success: false,
        error: rpcResult?.error || 'Failed to update profile.'
      });
    }

    if (rpcResult.email_changed) {
      // Send verification email to new address
      try {
        await sendMail(
          rpcResult.email,
          "Verify Your New Email - Tita's Vape Shop",
          generateVerificationEmail(rpcResult.otp_code, rpcResult.full_name)
        );
      } catch (mailErr) {
        console.error('[Customer Update Profile] Email dispatch error:', mailErr);
      }

      return res.json({
        success: true,
        email_changed: true,
        pending_verification: true,
        email: rpcResult.email,
        message: rpcResult.message || `A 6-digit verification code has been sent to ${rpcResult.email}.`
      });
    }

    if (rpcResult.customer) {
      const customerPayload = rpcResult.customer;
      const newToken = jwt.sign(customerPayload, JWT_SECRET, { expiresIn: '30d' });
      res.cookie('customer_token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        email_changed: false,
        message: 'Profile updated successfully!',
        user: customerPayload
      });
    }

    return res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    console.error('[Customer Update Profile] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
