const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * POST /api/customer/orders/submit-payment
 * POST /api/orders/submit-payment (alias)
 * 1-to-1 RPC endpoint calling customer_submit_payment_proof
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

    // Try customer_submit_payment_proof RPC 1-to-1
    const { data: rpcData, error: rpcError } = await client.rpc('customer_submit_payment_proof', {
      p_order_id: order_id,
      p_reference: cleanRef,
      p_receipt_url: receipt_url.trim(),
      p_phone: phone ? phone.trim() : null
    });

    if (!rpcError && rpcData) {
      return res.json({ success: true, ...rpcData });
    }

    // If RPC threw a specific validation error, return it
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
    console.error('[Submit Payment Proof] Exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

module.exports = router;
