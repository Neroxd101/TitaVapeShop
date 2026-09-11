const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/batch
 * POST /api/orders/track-batch (alias)
 * Fetch recent orders for authenticated customer
 * Calls RPC customer_get_orders with direct database query fallback
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

    // 1. Attempt customer_get_orders RPC
    try {
      const { data: rpcOrders, error: rpcError } = await client.rpc('customer_get_orders', {
        p_customer_id: customerPayload.id,
        p_limit: limit
      });

      if (!rpcError && Array.isArray(rpcOrders)) {
        return res.json({ success: true, orders: rpcOrders });
      }
    } catch (_) {}

    // 2. Direct table fallback
    const { data: orderRows, error: dbError } = await client
      .from('orders')
      .select('id, customer_id, customer_name, customer_email, order_type, total_amount, status, created_at, items')
      .or(`customer_id.eq.${customerPayload.id},customer_email.eq.${customerPayload.email}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dbError) {
      console.error('[Customer Get Orders] Query error:', dbError);
      return res.status(400).json({ success: false, error: dbError.message, orders: [] });
    }

    const results = (orderRows || []).map(row => ({
      id: row.id,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      order_type: row.order_type,
      total_amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
      items: row.items,
      items_count: Array.isArray(row.items)
        ? row.items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)
        : 0
    }));

    return res.json({ success: true, orders: results });
  } catch (err) {
    console.error('[Customer Get Orders] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while retrieving orders.' });
  }
});

module.exports = router;
