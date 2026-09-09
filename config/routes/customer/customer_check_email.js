const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/customer/check-email
 * Check if email is already registered in the customers table
 * Calls RPC customer_check_email with direct database fallback
 */
router.get('/api/customer/check-email', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanEmail = (req.query.email || '').trim().toLowerCase();
    const excludeUserId = req.query.exclude_user_id || null;

    if (!cleanEmail) {
      return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    }

    // 1. Attempt customer_check_email RPC
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_check_email', {
        p_email: cleanEmail,
        p_exclude_id: excludeUserId
      });
      if (!rpcError && rpcData && typeof rpcData.exists === 'boolean') {
        return res.json({
          success: true,
          exists: rpcData.exists,
          is_verified: rpcData.is_verified || false
        });
      }
    } catch (_) {}

    // 2. Direct table query fallback
    let query = client
      .from('customers')
      .select('id, email, is_verified')
      .ilike('email', cleanEmail);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: existingUser, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error('[Customer Check Email] Error:', checkError);
      return res.status(500).json({ success: false, error: 'Error checking email availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(existingUser),
      is_verified: existingUser ? Boolean(existingUser.is_verified) : false
    });
  } catch (err) {
    console.error('[Customer Check Email] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
