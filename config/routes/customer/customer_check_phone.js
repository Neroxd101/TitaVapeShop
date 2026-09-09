const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/customer/check-phone
 * Check if contact number is already registered in the customers table
 * Calls RPC customer_check_phone with direct database fallback
 */
router.get('/api/customer/check-phone', async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanPhone = (req.query.phone || '').trim().replace(/\D/g, '');
    const excludeUserId = req.query.exclude_user_id || null;

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid phone number is required.' });
    }

    // 1. Attempt customer_check_phone RPC
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_check_phone', {
        p_phone: cleanPhone,
        p_exclude_id: excludeUserId
      });
      if (!rpcError && rpcData && typeof rpcData.exists === 'boolean') {
        return res.json({
          success: true,
          exists: rpcData.exists
        });
      }
    } catch (_) {}

    // 2. Direct table query fallback
    let query = client
      .from('customers')
      .select('id, contact_number')
      .or(`contact_number.eq.${cleanPhone},contact_number.eq.0${cleanPhone.slice(-10)},contact_number.eq.+63${cleanPhone.slice(-10)}`);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: existingUser, error: checkError } = await query.maybeSingle();

    if (checkError) {
      console.error('[Customer Check Phone] Error:', checkError);
      return res.status(500).json({ success: false, error: 'Error checking phone availability.' });
    }

    return res.json({
      success: true,
      exists: Boolean(existingUser)
    });
  } catch (err) {
    console.error('[Customer Check Phone] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
