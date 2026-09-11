const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateVerificationEmail, sendMail } = require('./customer_mailer');

const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/register
 * Register a new customer and dispatch 6-digit OTP email via customer_register RPC
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

    // Call customer_register RPC
    const { data: rpcResult, error: rpcError } = await client.rpc('customer_register', {
      p_full_name: full_name.trim(),
      p_email: cleanEmail,
      p_contact_number: digitsOnly,
      p_password_hash: hashedPassword,
      p_birthday: birthDateFormatted
    });

    if (rpcError) {
      console.error('[Customer Register] RPC Error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Registration failed.' });
    }

    if (!rpcResult || !rpcResult.success || !rpcResult.otp_code) {
      return res.status(400).json({
        success: false,
        error: rpcResult?.error || 'Failed to register account.'
      });
    }

    const otpCode = rpcResult.otp_code;

    // Send verification email
    try {
      await sendMail(
        cleanEmail,
        "Verify Your Email - Tita's Vape Shop",
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
