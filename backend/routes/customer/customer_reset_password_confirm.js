const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');
const bcrypt = require('bcryptjs');

function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 72) {
    return 'Password must not exceed 72 characters.';
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

router.post('/api/customer/reset-password', async (req, res) => {
  try {
    if (!supabaseAdmin) {
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

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('customer_reset_password_confirm', {
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
