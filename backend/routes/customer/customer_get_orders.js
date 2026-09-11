const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/batch
 * POST /api/orders/track-batch (alias)
 * Fetch recent orders for authenticated customer via customer_get_orders RPC
 */
router.post(['/api/customer/orders/batch', '/api/orders/track-batch'], async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    // Require verified logged-in customer session
    const customerToken = req.cookies?.customer_token;
    if (!customerToken) {
      return res.json({
        success: false,
        requiresAuth: true,
        error: 'Please sign in to view your orders.',
        orders: []
      });
    }

    let customerPayload = null;
    try {
      customerPayload = jwt.verify(customerToken, JWT_SECRET);
    } catch (_) {
      return res.json({
        success: false,
        requiresAuth: true,
        error: 'Session expired. Please sign in again.',
        orders: []
      });
    }

    if (!customerPayload || !customerPayload.id) {
      return res.json({
        success: false,
        requiresAuth: true,
        error: 'Invalid session. Please sign in again.',
        orders: []
      });
    }

    const limit = Math.min(parseInt(req.body?.limit) || 25, 50);

    const { data: rpcOrders, error: rpcError } = await client.rpc('customer_get_orders', {
      p_customer_id: customerPayload.id,
      p_limit: limit
    });

    if (rpcError) {
      console.error('[Customer Get Orders] RPC error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message, orders: [] });
    }

    return res.json({ success: true, orders: rpcOrders || [] });
  } catch (err) {
    console.error('[Customer Get Orders] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while retrieving orders.' });
  }
});

module.exports = router;
