const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../database/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/cancel
 * POST /api/orders/cancel (alias for existing frontend callers)
 * Cancels a pending order after verifying ownership (session or phone)
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

    // 1. Attempt customer_cancel_order RPC
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('customer_cancel_order', {
        p_order_id: id,
        p_customer_id: customerId,
        p_customer_email: customerEmail,
        p_phone: trimmedPhone
      });

      if (!rpcError && rpcData) {
        const order = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (order) {
          return res.json({ success: true, order });
        }
      }

      if (rpcError && rpcError.message) {
        // If error is a business logic validation error from RPC, return it directly
        if (
          rpcError.message.includes('not authorized') ||
          rpcError.message.includes('pending orders can be cancelled') ||
          rpcError.message.includes('not found')
        ) {
          const status = rpcError.message.includes('not authorized') ? 403 : 409;
          return res.status(status).json({ success: false, error: rpcError.message });
        }
      }
    } catch (_) {
      // Fall through to direct table query fallback
    }

    // 2. Direct table query & update fallback
    const { data: existingOrder, error: fetchErr } = await client
      .from('orders')
      .select('id, customer_id, customer_email, customer_name, contact_number, order_type, items, total_amount, status')
      .eq('id', id)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return res.status(409).json({
        success: false,
        error: 'Only pending orders can be cancelled. This order may already have been updated.'
      });
    }

    // Verify ownership
    let isVerified = false;
    if (customerId && existingOrder.customer_id === customerId) {
      isVerified = true;
    } else if (customerEmail && existingOrder.customer_email && existingOrder.customer_email.toLowerCase() === customerEmail.toLowerCase()) {
      isVerified = true;
    } else if (trimmedPhone) {
      const inputDigits = trimmedPhone.replace(/\D/g, '');
      const orderDigits = String(existingOrder.contact_number || '').replace(/\D/g, '');
      if ((inputDigits.length >= 4 && orderDigits.endsWith(inputDigits)) || orderDigits === inputDigits) {
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to cancel this order. Please sign in with your account.'
      });
    }

    // Execute cancellation update
    const { data: updatedOrder, error: updateErr } = await client
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, customer_id, customer_name, contact_number, customer_email, order_type, items, total_amount, status, created_at, updated_at')
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        error: 'Only pending orders can be cancelled. This order may already have been updated.'
      });
    }

    // Attempt audit log
    try {
      await client.rpc('transactions_log', {
        p_action_type: 'order_cancel',
        p_user_email: customerEmail || 'Customer',
        p_entity_id: updatedOrder.id,
        p_entity_type: 'order',
        p_sale_total: updatedOrder.total_amount,
        p_sale_items: updatedOrder.items,
        p_customer_name: updatedOrder.customer_name,
        p_customer_email: updatedOrder.customer_email,
        p_details: {
          order_id: updatedOrder.id,
          order_type: updatedOrder.order_type,
          previous_status: 'pending',
          cancelled_by: 'customer',
          items_count: Array.isArray(updatedOrder.items) ? updatedOrder.items.length : 0
        }
      });
    } catch (logErr) {
      console.error('[Customer Cancel Order] Audit log skipped/failed:', logErr.message);
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('[Customer Cancel Order] Error:', error);
    return res.status(500).json({ success: false, error: 'Unable to cancel your order. Please try again.' });
  }
});

module.exports = router;
