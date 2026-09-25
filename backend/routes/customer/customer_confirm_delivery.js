const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');

router.post(['/api/customer/orders/confirm-delivery', '/api/orders/confirm-delivery'], async (req, res) => {
  try {
    const { id, phone } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ success: false, error: 'A valid order ID is required.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Delivery confirmation is unavailable.' });

    let customer = null;
    if (req.cookies?.customer_token && process.env.JWT_SECRET) {
      try { customer = jwt.verify(req.cookies.customer_token, process.env.JWT_SECRET); } catch (_) {}
    }
    const { data, error } = await supabaseAdmin.rpc('customer_confirm_delivery', {
      p_order_id: id,
      p_customer_id: customer?.id || null,
      p_customer_email: customer?.email || null,
      p_phone: typeof phone === 'string' ? phone.trim() : null
    });
    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, order: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    console.error('[Customer Confirm Delivery] Error:', error);
    return res.status(500).json({ success: false, error: 'Unable to confirm delivery.' });
  }
});

module.exports = router;
