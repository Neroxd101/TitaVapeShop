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
 * Step 1: Request password reset code
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
    let targetName = 'Customer';
    let customerFound = false;

    // 1. Attempt RPC customer_reset_password_request
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_request', {
        p_email: cleanEmail,
        p_otp_code: otpCode
      });

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row && row.success) {
          customerFound = true;
          targetName = row.full_name || 'Customer';
        }
      }
    } catch (_) {
      // Fallback to direct query
    }

    // 2. Direct table fallback if RPC wasn't applied or returned null
    if (!customerFound) {
      const { data: customer, error: findError } = await client
        .from('customers')
        .select('id, full_name, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (!findError && customer) {
        customerFound = true;
        targetName = customer.full_name || 'Customer';

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { error: insertErr } = await client
          .from('customer_verification_codes')
          .insert({
            customer_id: customer.id,
            email: cleanEmail,
            otp_code: otpCode,
            expires_at: expiresAt,
            verified: false
          });

        if (insertErr) {
          console.error('[Customer Reset Password] Code insert error:', insertErr);
        }
      }
    }

    // Send reset email if customer exists
    if (customerFound) {
      try {
        await sendMail(
          cleanEmail,
          'Password Reset Code - Tita\'s Vape Shop',
          generatePasswordResetEmail(otpCode, targetName)
        );
      } catch (mailErr) {
        console.error('[Customer Reset Password] Email sending error:', mailErr);
      }
    }

    // Always return success message for security (prevents account enumeration)
    return res.json({
      success: true,
      message: 'If an account is associated with this email, a 6-digit verification code has been sent.'
    });
  } catch (err) {
    console.error('[Customer Forgot Password] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process request. Please try again.' });
  }
});

/**
 * POST /api/customer/verify-reset-code
 * Step 2: Validate 6-digit OTP code before displaying new password fields
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

    // 1. Attempt RPC customer_reset_password_verify_code
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_verify_code', {
        p_email: cleanEmail,
        p_otp_code: cleanCode
      });

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row && row.success) {
          return res.json({
            success: true,
            message: row.message || 'Code verified successfully.'
          });
        }
        if (row && row.error) {
          return res.status(400).json({ success: false, error: row.error });
        }
      }
    } catch (_) {
      // Fall through to direct table fallback
    }

    // 2. Direct table fallback
    const nowIso = new Date().toISOString();
    const { data: codeRows, error: codeErr } = await client
      .from('customer_verification_codes')
      .select('id, customer_id, email, expires_at, verified')
      .eq('email', cleanEmail)
      .eq('otp_code', cleanCode)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeErr || !codeRows || codeRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please request a new code.'
      });
    }

    // Mark code as verified
    await client
      .from('customer_verification_codes')
      .update({ verified: true })
      .eq('id', codeRows[0].id);

    return res.json({
      success: true,
      message: 'Code verified successfully.'
    });
  } catch (err) {
    console.error('[Customer Verify Reset Code] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify code. Please try again.' });
  }
});

/**
 * POST /api/customer/reset-password
 * Step 3: Save new password after OTP is confirmed
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

    // Validate password complexity
    const passwordError = validatePasswordStrength(new_password);
    if (passwordError) {
      return res.status(400).json({ success: false, error: passwordError });
    }

    // Hash password with bcrypt
    const hashedPassword = bcrypt.hashSync(new_password, 10);

    // 1. Attempt RPC customer_reset_password_confirm
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_reset_password_confirm', {
        p_email: cleanEmail,
        p_otp_code: cleanCode,
        p_new_password_hash: hashedPassword
      });

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row && row.success) {
          return res.json({
            success: true,
            message: row.message || 'Password has been reset successfully. You can now sign in.'
          });
        }
        if (row && row.error) {
          return res.status(400).json({ success: false, error: row.error });
        }
      }
    } catch (_) {
      // Fall through to direct table fallback
    }

    // 2. Direct table fallback
    const nowIso = new Date().toISOString();
    const { data: codeRows, error: codeErr } = await client
      .from('customer_verification_codes')
      .select('id, customer_id, email, expires_at, verified')
      .eq('email', cleanEmail)
      .eq('otp_code', cleanCode)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);

    if (codeErr || !codeRows || codeRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please request a new code.'
      });
    }

    const matchedCode = codeRows[0];

    // Invalidate code so it cannot be reused
    await client
      .from('customer_verification_codes')
      .update({ verified: true, expires_at: nowIso })
      .eq('id', matchedCode.id);

    // Update customer password
    const { data: updatedCustomer, error: updateErr } = await client
      .from('customers')
      .update({
        password: hashedPassword,
        is_verified: true,
        updated_at: new Date().toISOString()
      })
      .ilike('email', cleanEmail)
      .select('id, full_name, email')
      .maybeSingle();

    if (updateErr || !updatedCustomer) {
      return res.status(400).json({
        success: false,
        error: 'Customer account not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('[Customer Reset Password] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password. Please try again.' });
  }
});

module.exports = router;
