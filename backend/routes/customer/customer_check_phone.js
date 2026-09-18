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
 * POST /api/customer/check-phone
 * Check if contact number is already registered via customer_check_phone RPC
 */
router.post('/api/customer/check-phone', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanPhone = (req.body?.phone || '').trim().replace(/\D/g, '');

    if (!/^09\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'A valid 11-digit phone number is required.' });
    }

    const { data, error } = await supabaseAdmin.rpc('customer_check_phone', {
      p_phone: cleanPhone,
      p_exclude_id: getSessionCustomerId(req)
    });

    if (error) {
      console.error('[Customer Check Phone] RPC Error:', error);
      return res.status(500).json({ success: false, error: 'Error checking phone availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(data?.exists)
    });
  } catch (err) {
    console.error('[Customer Check Phone] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
