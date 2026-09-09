const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateCode, generateVerificationEmail, sendMail } = require('./customer_mailer');

const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/register
 * Register a new customer and dispatch 6-digit OTP email
 * Matches RPC: customer_register
 */
router.post('/api/customer/register', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { full_name, email, contact_number, password, birthday } = req.body;

    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Please enter your full name (minimum 2 characters).' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    const digitsOnly = (contact_number || '').replace(/\D/g, '');
    if (digitsOnly.length !== 11) {
      return res.status(400).json({ success: false, error: 'Contact number must be exactly 11 digits (e.g. 09123456789).' });
    }

    if (!birthday) {
      return res.status(400).json({ success: false, error: 'Date of birth is required.' });
    }

    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid date of birth.' });
    }

    // Age validation: Republic Act No. 11900 requires buyers to be at least 18 years old
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(403).json({
        success: false,
        error: 'You must be at least 18 years of age to register and purchase vapor products under Republic Act No. 11900.'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        error: 'Password must include an uppercase letter, lowercase letter, number, and special character.'
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const birthDateFormatted = birthDate.toISOString().split('T')[0];

    let otpCode = null;

    // 1. Attempt customer_register RPC
    try {
      const { data: rpcResult, error: rpcError } = await client.rpc('customer_register', {
        p_full_name: full_name.trim(),
        p_email: cleanEmail,
        p_contact_number: digitsOnly,
        p_password_hash: hashedPassword,
        p_birthday: birthDateFormatted
      });

      if (!rpcError && rpcResult && rpcResult.success) {
        otpCode = rpcResult.otp_code;
      } else if (rpcResult && rpcResult.error) {
        return res.status(400).json({ success: false, error: rpcResult.error });
      }
    } catch (_) {}

    // 2. Direct fallback if RPC is not yet applied
    if (!otpCode) {
      // Check if email already exists in customers table
      const { data: existingUser } = await client
        .from('customers')
        .select('id, email, is_verified')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ success: false, error: 'This email already exists. Please sign in.' });
      }

      // Check if contact number already exists in customers table
      const { data: existingPhoneUser } = await client
        .from('customers')
        .select('id, contact_number')
        .or(`contact_number.eq.${digitsOnly},contact_number.eq.0${digitsOnly.slice(-10)},contact_number.eq.+63${digitsOnly.slice(-10)}`)
        .maybeSingle();

      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          error: 'This mobile number already exists. Please use a different number or sign in.'
        });
      }

      const insertPayload = {
        email: cleanEmail,
        password: hashedPassword,
        full_name: full_name.trim(),
        contact_number: digitsOnly,
        birthday: birthDateFormatted,
        is_verified: false
      };

      let { data: newCustomer, error: insertError } = await client
        .from('customers')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        console.error('[Customer Register] Insert error:', insertError);
        return res.status(500).json({ success: false, error: insertError.message || 'Failed to create account.' });
      }
      const customerId = newCustomer.id;

      otpCode = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: otpError } = await client
        .from('customer_verification_codes')
        .insert({
          customer_id: customerId,
          user_id: customerId,
          email: cleanEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
          verified: false
        });

      if (otpError) {
        console.error('[Customer Register] OTP insert error:', otpError);
        return res.status(500).json({ success: false, error: 'Failed to generate verification code.' });
      }
    }

    // Send verification email
    try {
      await sendMail(
        cleanEmail,
        'Verify Your Email - Tita\'s Vape Shop',
        generateVerificationEmail(otpCode, full_name.trim())
      );
    } catch (mailErr) {
      console.error('[Customer Register] Email send error:', mailErr);
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email address.',
      email: cleanEmail
    });
  } catch (err) {
    console.error('[Customer Register] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
