const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');

router.post(['/api/customer/orders/submit-payment', '/api/orders/submit-payment'], async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { order_id, reference, receipt_url, phone } = req.body || {};
    if (!order_id || typeof reference !== 'string' || typeof receipt_url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Order ID, reference number, and receipt URL are required.'
      });
    }

    let customerPayload = null;
    if (req.cookies?.customer_token && process.env.JWT_SECRET) {
      try {
        customerPayload = jwt.verify(req.cookies.customer_token, process.env.JWT_SECRET);
      } catch (_) {}
    }

    const { data, error } = await supabaseAdmin.rpc('customer_submit_payment_proof', {
      p_order_id: order_id,
      p_reference: reference.trim(),
      p_receipt_url: receipt_url.trim(),
      p_customer_id: customerPayload?.id || null,
      p_customer_email: customerPayload?.email || null,
      p_phone: typeof phone === 'string' ? phone.trim() : null
    });

    if (error) {
      const forbidden = error.message?.includes('not authorized');
      return res.status(forbidden ? 403 : 400).json({
        success: false,
        error: error.message || 'Failed to submit payment proof'
      });
    }

    return res.json(data);
  } catch (error) {
    console.error('[Submit Payment Proof] Exception:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
