const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');

function getSessionCustomerId(req) {
  const token = req.cookies?.customer_token;
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload?.role === 'customer' && payload.id ? payload.id : null;
  } catch (_) {
    return null;
  }
}

/**
 * POST /api/customer/check-email
 * Check if email is already registered via customer_check_email RPC
 */
router.post('/api/customer/check-email', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanEmail = (req.body?.email || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'A valid email parameter is required.' });
    }

    const { data, error } = await supabaseAdmin.rpc('customer_check_email', {
      p_email: cleanEmail,
      p_exclude_id: getSessionCustomerId(req)
    });

    if (error) {
      console.error('[Customer Check Email] RPC Error:', error);
      return res.status(500).json({ success: false, error: 'Error checking email availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(data?.exists)
    });
  } catch (err) {
    console.error('[Customer Check Email] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
