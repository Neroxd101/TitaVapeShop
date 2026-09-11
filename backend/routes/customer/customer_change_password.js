const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
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
 * POST /api/customer/change-password
 * Change password for authenticated customer
 */
router.post('/api/customer/change-password', async (req, res) => {
  const token = req.cookies?.customer_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Please sign in to change your password.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.clearCookie('customer_token');
    return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
  }

  const { current_password, new_password } = req.body || {};

  if (!current_password) {
    return res.status(400).json({ success: false, error: 'Current password is required.' });
  }

  if (!new_password) {
    return res.status(400).json({ success: false, error: 'New password is required.' });
  }

  const passwordError = validatePasswordStrength(new_password);
  if (passwordError) {
    return res.status(400).json({ success: false, error: passwordError });
  }

  const client = dbClient();
  if (!client) {
    return res.status(500).json({ success: false, error: 'Database service unavailable' });
  }

  try {
    // 1. Fetch current password hash
    const { data: customer, error: fetchErr } = await client
      .from('customers')
      .select('id, password')
      .eq('id', decoded.id)
      .maybeSingle();

    if (fetchErr || !customer) {
      return res.status(404).json({ success: false, error: 'Customer account not found.' });
    }

    // 2. Verify current password
    const isCurrentValid = bcrypt.compareSync(current_password, customer.password || '');
    if (!isCurrentValid) {
      return res.status(400).json({ success: false, error: 'Incorrect current password. Please try again.' });
    }

    // 3. Ensure new password is not identical to current password
    const isSamePassword = bcrypt.compareSync(new_password, customer.password || '');
    if (isSamePassword) {
      return res.status(400).json({ success: false, error: 'New password cannot be the same as your current password.' });
    }

    // 4. Hash new password
    const newHash = bcrypt.hashSync(new_password, 10);

    // 5. Update via RPC customer_change_password
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_change_password', {
        p_customer_id: decoded.id,
        p_new_password_hash: newHash
      });

      if (!rpcError && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row && row.success) {
          return res.json({
            success: true,
            message: row.message || 'Password updated successfully!'
          });
        }
        if (row && row.error) {
          return res.status(400).json({ success: false, error: row.error });
        }
      }
    } catch (_) {
      // Fall through to direct table fallback
    }

    // 6. Direct table fallback
    const { error: updateErr } = await client
      .from('customers')
      .update({
        password: newHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.id);

    if (updateErr) {
      console.error('[Customer Change Password] Update error:', updateErr);
      return res.status(500).json({ success: false, error: 'Failed to update password. Please try again.' });
    }

    return res.json({
      success: true,
      message: 'Password updated successfully!'
    });
  } catch (err) {
    console.error('[Customer Change Password] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred while changing password.' });
  }
});

module.exports = router;
