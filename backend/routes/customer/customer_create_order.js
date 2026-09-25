const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../../database/supabase');
const { sendOrderEmail } = require('../admin/admin/orders/orders_email');

router.post(['/api/customer/orders/create', '/api/orders/create'], async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, error: 'Customer authentication is not configured' });
    }

    const customerToken = req.cookies?.customer_token;
    if (!customerToken) {
      return res.status(401).json({ success: false, error: 'Please sign in to place an order.' });
    }

    let customerPayload;
    try {
      customerPayload = jwt.verify(customerToken, process.env.JWT_SECRET);
    } catch (_) {
      return res.status(401).json({ success: false, error: 'Your session has expired. Please sign in again.' });
    }
    if (!customerPayload?.id) {
      return res.status(401).json({ success: false, error: 'Invalid customer session.' });
    }

    const { items, order_type } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one item.' });
    }

    const requestedItems = items.map(item => ({
      id: item?.id,
      quantity: Number(item?.quantity),
      selected_variation: typeof item?.selected_variation === 'string' ? item.selected_variation.trim() : null
    }));
    if (requestedItems.some(item => !item.id || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      return res.status(400).json({ success: false, error: 'Invalid items in cart.' });
    }

    const { data, error } = await supabaseAdmin.rpc('customer_create_order', {
      p_customer_id: customerPayload.id,
      p_items: requestedItems,
      p_order_type: order_type || 'pickup'
    });

    if (error) {
      console.error('[Customer Create Order] RPC Error:', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to create order' });
    }

    const order = Array.isArray(data) ? data[0] : data;
    if (!order?.id) {
      return res.status(400).json({ success: false, error: 'Failed to create order.' });
    }

    const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const trackingUrl = `${appBaseUrl}/order-status?id=${order.id}`;

    if (order.customer_email) {
      sendOrderEmail(order.customer_email, order.customer_name, order.id, 'pending', {
        items: order.items,
        total_amount: order.total_amount,
        order_type: order.order_type,
        trackingUrl
      }).catch(emailError => console.error('[Customer Create Order] Email error:', emailError));
    }

    return res.json({ success: true, order, trackingUrl });
  } catch (error) {
    console.error('[Customer Create Order] Exception:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while creating order.' });
  }
});

module.exports = router;
