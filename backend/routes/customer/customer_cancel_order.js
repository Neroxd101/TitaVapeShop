const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/cancel
 * POST /api/orders/cancel (alias for existing frontend callers)
 * Cancels a pending order via customer_cancel_order RPC
 */
router.post(['/api/customer/orders/cancel', '/api/orders/cancel'], async (req, res) => {
  try {
    const { id, phone } = req.body || {};

    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ success: false, error: 'A valid order ID is required.' });
    }

    const client = dbClient();
    if (!client) {
      return res.status(503).json({ success: false, error: 'Order cancellation is currently unavailable.' });
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

    // Call customer_cancel_order RPC
    const { data, error } = await client.rpc('customer_cancel_order', {
      p_order_id: id,
      p_customer_id: customerId,
      p_customer_email: customerEmail,
      p_phone: trimmedPhone
    });

    if (error) {
      const isForbidden = error.message && error.message.includes('not authorized');
      const isConflict = error.message && error.message.includes('pending orders can be cancelled');
      const status = isForbidden ? 403 : (isConflict ? 409 : 400);
      return res.status(status).json({ success: false, error: error.message });
    }

    const order = Array.isArray(data) ? data[0] : data;
    return res.json({ success: true, order });
  } catch (error) {
    console.error('[Customer Cancel Order] Error:', error);
    return res.status(500).json({ success: false, error: 'Unable to cancel your order. Please try again.' });
  }
});

module.exports = router;
