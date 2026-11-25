const express = require('express');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { verifyProfileOtp } = require('./user_profile_verify_otp');

const router = express.Router();

router.post('/api/user/profile/update-email', isAuthenticated, hasRole(['admin']), async (req, res) => {
  const { new_email, otp, current_password } = req.body || {};
  const email = typeof new_email === 'string' ? new_email.trim().toLowerCase() : '';
  if (email.length > 50 || !/^[^\s@\\*]+@[^\s@\\*]+\.[^\s@\\*]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address of up to 50 characters.' });
  }
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, error: 'Enter a valid 6-digit verification code.' });
  }
  if (typeof current_password !== 'string' || !current_password) {
    return res.status(400).json({ success: false, error: 'Enter your current password.' });
  }

  const userId = req.user.id;
  const duplicateError = 'This email address is already in use.';
  try {
    const { data: account, error: accountError } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('id', userId)
      .eq('session_version', req.user.session_version)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account || !await bcrypt.compare(current_password, account.password)) {
      return res.status(403).json({ success: false, error: 'Incorrect current password.' });
    }

    // Admin sign-in compares email addresses and usernames case-insensitively.
    const pattern = email.replace(/[%_]/g, '\\$&');
    const { data: conflicts, error: lookupError } = await supabaseAdmin
      .from('users')
      .select('id')
      .neq('id', userId)
      .ilike('email', pattern)
      .limit(1);
    if (lookupError) throw lookupError;
    if (conflicts.length) return res.status(409).json({ success: false, error: duplicateError });

    const { data: usernames, error: usernameError } = await supabaseAdmin
      .from('users')
      .select('id')
      .neq('id', userId)
      .ilike('username', pattern)
      .limit(1);
    if (usernameError) throw usernameError;
    if (usernames.length) return res.status(409).json({ success: false, error: duplicateError });

    const { data: verification, error: verifyError } = await verifyProfileOtp(userId, otp);
    if (verifyError) throw verifyError;
    if (!verification?.success) {
      return res.status(400).json({ success: false, error: verification?.error || 'Invalid or expired verification code.' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ email })
      .eq('id', userId)
      .eq('roles', req.user.roles)
      .eq('session_version', req.user.session_version)
      .select('email')
      .maybeSingle();
    if (updateError?.code === '23505') {
      return res.status(409).json({ success: false, error: duplicateError });
    }
    if (updateError) throw updateError;
    if (!updated) return res.status(403).json({ success: false, error: 'Your session changed. Sign in again to update your email.' });

    return res.json({ success: true, email: updated.email });
  } catch (error) {
    console.error('Update admin email failed:', error.code || error.name);
    return res.status(500).json({ success: false, error: 'Could not update your email. Please request a new verification code and try again.' });
  }
});

module.exports = router;
