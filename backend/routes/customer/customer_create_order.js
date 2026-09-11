const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');
const { sendOrderEmail } = require('../admin/admin/orders/orders_email');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/create
 * POST /api/orders/create (alias)
 * Customer Order Creation Endpoint via customer_create_order RPC
 */
router.post(['/api/customer/orders/create', '/api/orders/create'], async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    // 1. Enforce verified customer session
    const customerToken = req.cookies?.customer_token;
    if (!customerToken) {
      return res.status(401).json({
        success: false,
        error: 'Please sign in or create a verified customer account to place an order.'
      });
    }

    let customerPayload = null;
    try {
      customerPayload = jwt.verify(customerToken, JWT_SECRET);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: 'Your session has expired. Please sign in again.'
      });
    }

    const { data: dbCustomer, error: customerErr } = await client
      .from('customers')
      .select('id, is_verified, email, full_name, contact_number')
      .eq('id', customerPayload.id)
      .maybeSingle();

    if (customerErr || !dbCustomer || !dbCustomer.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Your email address is not verified yet. Please verify your email before placing an order.'
      });
    }

    const { customer_name, contact_number, customer_email, order_type, items, total_amount } = req.body;

    const finalEmail = dbCustomer.email || customer_email;
    const finalName = customer_name || dbCustomer.full_name;
    const finalContact = contact_number || dbCustomer.contact_number;

    // 2. Validate Items Payload
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one item.' });
    }

    const requested = items
      .map(i => ({
        id: i?.id,
        quantity: Number.isFinite(Number(i?.quantity)) ? Number(i.quantity) : NaN
      }))
      .filter(i => i.id);

    if (requested.length === 0 || requested.some(i => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      return res.status(400).json({ success: false, error: 'Invalid items in cart.' });
    }

    // 3. Check Live Inventory Stock
    const uniqueIds = [...new Set(requested.map(i => i.id))];
    const { data: invRows, error: invError } = await client
      .from('inventory')
      .select('id, name, quantity')
      .in('id', uniqueIds);

    if (invError) {
      console.error('[Customer Create Order] Inventory check error:', invError);
      return res.status(400).json({ success: false, error: invError.message || 'Failed to validate stock' });
    }

    const invMap = new Map((invRows || []).map(r => [r.id, r]));
    const insufficient = requested
      .map(r => {
        const row = invMap.get(r.id);
        const available = row?.quantity ?? 0;
        return {
          id: r.id,
          name: row?.name || null,
          requested: r.quantity,
          available
        };
      })
      .filter(x => x.requested > x.available);

    if (insufficient.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Insufficient stock for selected items',
        items: insufficient
      });
    }

    // 4. Execute customer_create_order RPC
    const { data: rpcData, error: rpcError } = await client.rpc('customer_create_order', {
      p_customer_id: dbCustomer.id,
      p_customer_name: finalName,
      p_contact_number: finalContact,
      p_items: items,
      p_total_amount: total_amount,
      p_order_type: order_type || 'pickup',
      p_customer_email: finalEmail
    });

    if (rpcError) {
      console.error('[Customer Create Order] RPC Error:', rpcError);
      return res.status(400).json({ success: false, error: rpcError.message || 'Failed to create order' });
    }

    const order = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData;
    if (!order) {
      return res.status(400).json({ success: false, error: 'Failed to create order' });
    }

    const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const trackingUrl = `${appBaseUrl}/order-status?id=${order.id}`;

    // 5. Send Order Confirmation Email
    if (order && finalEmail) {
      try {
        await sendOrderEmail(
          finalEmail,
          finalName,
          order.id,
          'pending',
          {
            items: items,
            total_amount: total_amount,
            order_type: order_type,
            trackingUrl: trackingUrl
          }
        );
      } catch (emailError) {
        console.error('[Customer Create Order] Confirmation email dispatch error:', emailError);
      }
    }

    return res.json({
      success: true,
      order: order,
      trackingUrl: trackingUrl
    });
  } catch (err) {
    console.error('[Customer Create Order] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while creating order.' });
  }
});

module.exports = router;
