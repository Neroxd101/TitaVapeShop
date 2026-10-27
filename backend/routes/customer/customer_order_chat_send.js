const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');

router.post('/api/customer/orders/chat-send', async (req, res) => {
  try {
    const { id, phone, message } = req.body || {};
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ success: false, error: 'A valid order ID is required.' });
    }
    if (typeof message !== 'string' || !message.trim() || message.trim().length > 1000) {
      return res.status(400).json({ success: false, error: 'Messages must contain 1–1,000 characters.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Chat are unavailable.' });

    let customer = null;
    if (req.cookies?.customer_token && process.env.JWT_SECRET) {
      try { customer = jwt.verify(req.cookies.customer_token, process.env.JWT_SECRET); } catch (_) {}
    }
    const { data, error } = await supabaseAdmin.rpc('customer_order_chat_send', {
      p_order_id: id,
      p_message: message.trim(),
      p_customer_id: customer?.id || null,
      p_customer_email: customer?.email || null,
      p_phone: typeof phone === 'string' ? phone.trim() : null
    });
    if (error) return res.status(400).json({ success: false, error: error.message });
    const sent = Array.isArray(data) ? data[0] : data;
    if (!sent) return res.status(404).json({ success: false, error: 'Order not found.' });
    return res.json({ success: true, message: sent });
  } catch (error) {
    console.error('[Customer Chat Send] Error:', error);
    return res.status(500).json({ success: false, error: 'Unable to save message.' });
  }
});

module.exports = router;
