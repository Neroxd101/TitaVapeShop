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
      } catch (_) { }
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

/**
 * POST /api/customer/orders/submit-payment
 * Customer Payment Submission Endpoint
 */
router.post(['/api/customer/orders/submit-payment', '/api/orders/submit-payment'], async (req, res) => {
  try {
    const { order_id, reference, receipt_url, phone } = req.body;

    if (!order_id || !reference || !receipt_url) {
      return res.status(400).json({
        success: false,
        error: 'Order ID, reference number, and receipt URL are required.'
      });
    }

    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const cleanRef = reference.trim();

    // Check if this reference number was already used for another active order
    const { data: existingRefOrder, error: checkRefError } = await client
      .from('orders')
      .select('id, payment_status, status')
      .ilike('payment_reference', cleanRef)
      .neq('id', order_id)
      .not('status', 'in', '("cancelled","voided")')
      .not('payment_status', 'eq', 'rejected')
      .limit(1)
      .maybeSingle();

    if (!checkRefError && existingRefOrder) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid reference number.'
      });
    }

    // Try RPC first
    const { data: rpcData, error: rpcError } = await client.rpc('customer_submit_payment_proof', {
      p_order_id: order_id,
      p_reference: cleanRef,
      p_receipt_url: receipt_url.trim(),
      p_phone: phone ? phone.trim() : null
    });

    if (!rpcError && rpcData) {
      return res.json({ success: true, ...rpcData });
    }

    // If RPC threw a friendly exception (e.g. duplicate reference or phone mismatch), return it directly
    if (rpcError && rpcError.message && (
      rpcError.message.includes('reference number') ||
      rpcError.message.includes('Contact number') ||
      rpcError.message.includes('not match')
    )) {
      return res.status(400).json({ success: false, error: rpcError.message });
    }

    // Fallback direct update (in case RPC is not yet executed in remote DB)
    const { data: updated, error: updateError } = await client
      .from('orders')
      .update({
        payment_reference: cleanRef,
        payment_receipt_url: receipt_url.trim(),
        payment_status: 'pending_verification',
        payment_method: 'gcash',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select('id, payment_status, payment_reference, payment_receipt_url')
      .single();

    if (updateError) {
      console.error('[Submit Payment Proof] Update Error:', updateError);
      return res.status(400).json({ success: false, error: updateError.message || 'Failed to submit payment proof' });
    }

    return res.json({
      success: true,
      order_id: updated.id,
      payment_status: updated.payment_status,
      payment_reference: updated.payment_reference,
      payment_receipt_url: updated.payment_receipt_url
    });

  } catch (err) {
    console.error('[Submit Payment Proof] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
