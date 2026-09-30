const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../database/supabase');
const bcrypt = require('bcryptjs');

router.post('/api/password-reset/reset', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Password reset service unavailable' });
    }

    const { token_id, new_password } = req.body;

    if (!token_id || !new_password) {
      return res.status(400).json({ success: false, error: 'Verified reset token and new password are required' });
    }

    if (new_password.length < 8 || new_password.length > 72 ||
        !/[A-Z]/.test(new_password) || !/[a-z]/.test(new_password) ||
        !/[0-9]/.test(new_password) || !/[^A-Za-z0-9]/.test(new_password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be 8–72 characters and include uppercase, lowercase, number, and symbol.'
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    const { data: updateData, error: rpcError } = await supabaseAdmin.rpc('password_reset_update_password', {
      p_token_id: token_id,
      p_new_password_hash: hashedPassword
    });

    if (rpcError || !updateData || !updateData.success) {
      const errorMessage = rpcError?.message || updateData?.error || 'Failed to reset password';
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
