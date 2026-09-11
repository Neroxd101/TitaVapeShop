const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/customer/orders/track
 * GET /api/orders/track (alias for backward compatibility)
 * Retrieves single order details via customer_track_order RPC
 */
router.get(['/api/customer/orders/track', '/api/orders/track'], async (req, res) => {
  try {
    const { id, phone } = req.query;
    const targetOrderId = typeof id === 'string' ? id.trim() : null;

    if (!targetOrderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetOrderId)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid order ID'
      });
    }

    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    // Check if customer is authenticated via cookie
    let customerPayload = null;
    if (req.cookies?.customer_token && JWT_SECRET) {
      try {
        customerPayload = jwt.verify(req.cookies.customer_token, JWT_SECRET);
      } catch (_) {}
    }

    const customerId = customerPayload?.id || null;
    const customerEmail = customerPayload?.email || null;
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : null;

    // Call customer_track_order RPC
    const { data: rpcData, error: rpcError } = await client.rpc('customer_track_order', {
      p_order_id: targetOrderId,
      p_customer_id: customerId,
      p_customer_email: customerEmail,
      p_phone: trimmedPhone
    });

    if (rpcError) {
      if (rpcError.message.includes('REQUIRES_PHONE')) {
        return res.status(401).json({
          success: false,
          requiresPhone: true,
          error: 'Please enter the contact number used during checkout to view this order.'
        });
      }
      if (rpcError.message.includes('does not match') || rpcError.message.includes('not authorized')) {
        return res.status(403).json({
          success: false,
          error: 'The contact number entered does not match this order.'
        });
      }
      if (rpcError.message.includes('Order not found')) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      return res.status(400).json({ success: false, error: rpcError.message });
    }

    const order = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    return res.json({
      success: true,
      order: order
    });
  } catch (err) {
    console.error('[Customer Track Order] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve order status' });
  }
});

module.exports = router;
