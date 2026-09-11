const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/customer/check-phone
 * Check if contact number is already registered via customer_check_phone RPC
 */
router.get('/api/customer/check-phone', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanPhone = (req.query.phone || '').trim().replace(/\D/g, '');
    const rawExclude = (req.query.exclude_user_id || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const excludeUserId = uuidRegex.test(rawExclude) ? rawExclude : null;

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    }

    const { data, error } = await client.rpc('customer_check_phone', {
      p_phone: cleanPhone,
      p_exclude_id: excludeUserId
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
