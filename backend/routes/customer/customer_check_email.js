const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/customer/check-email
 * Check if email is already registered via customer_check_email RPC
 */
router.get('/api/customer/check-email', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanEmail = (req.query.email || '').trim().toLowerCase();
    const rawExclude = (req.query.exclude_user_id || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const excludeUserId = uuidRegex.test(rawExclude) ? rawExclude : null;

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    }

    const { data, error } = await client.rpc('customer_check_email', {
      p_email: cleanEmail,
      p_exclude_id: excludeUserId
    });

    if (error) {
      console.error('[Customer Check Email] RPC Error:', error);
      return res.status(500).json({ success: false, error: 'Error checking email availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(data?.exists),
      is_verified: Boolean(data?.is_verified)
    });
  } catch (err) {
    console.error('[Customer Check Email] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
