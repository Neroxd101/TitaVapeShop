const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { generateCode, generatePasswordResetEmail, sendMail } = require('./customer_mailer');

const dbClient = () => supabaseAdmin || supabase;

/**
 * Validate customer password strength against store policy:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character / symbol
 */
function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return 'Password must contain at least one special character.';
  }
  return null;
}

/**
 * POST /api/customer/forgot-password
 * Step 1: Request password reset code via customer_reset_password_request RPC
 */
router.post('/api/customer/forgot-password', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const otpCode = generateCode();

    const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_request', {
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

/**
 * POST /api/customer/verify-reset-code
 * Step 2: Verify 6-digit OTP code before displaying new password fields via customer_reset_password_verify_code RPC
 */
router.post('/api/customer/verify-reset-code', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
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

    const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_verify_code', {
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

/**
 * POST /api/customer/reset-password
 * Step 3: Consume verified OTP and apply new password via customer_reset_password_confirm RPC
 */
router.post('/api/customer/reset-password', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { email, otp_code, new_password } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otp_code || '').trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ success: false, error: 'A valid 6-digit verification code is required.' });
    }

    if (!new_password) {
      return res.status(400).json({ success: false, error: 'New password is required.' });
    }

    const passwordError = validatePasswordStrength(new_password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    const hashedPassword = bcrypt.hashSync(new_password, 10);

    const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_confirm', {
      p_email: cleanEmail,
      p_otp_code: cleanCode,
      p_new_password_hash: hashedPassword
    });

    if (rpcError) {
      console.error('[Customer Reset Password] Confirm RPC error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Failed to reset password.' });
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row && !row.success) {
      return res.status(400).json({ success: false, error: row.error || 'Failed to reset password.' });
    }

    return res.json({
      success: true,
      message: row?.message || 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('[Customer Reset Password] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password. Please try again.' });
  }
});

module.exports = router;
