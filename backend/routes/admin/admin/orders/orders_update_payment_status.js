const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.post('/api/orders/update_payment_status', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { order_id, payment_status, reason } = req.body;
        if (!order_id || !payment_status) {
            return res.status(400).json({ success: false, error: 'order_id and payment_status are required' });
        }
        if (payment_status === 'rejected' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000)) {
            return res.status(400).json({ success: false, error: 'A rejection reason of 1–1000 characters is required' });
        }

        const userEmail = req.user?.username || req.user?.email || req.user?.id || 'system';
        const { data, error } = await supabaseAdmin.rpc('orders_update_payment_status', {
            p_order_id: order_id,
            p_payment_status: payment_status,
            p_user_email: userEmail,
            p_reason: payment_status === 'rejected' ? reason.trim() : null
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message || 'Failed to update payment status' });
        }

        const order = Array.isArray(data) ? data[0] : data;
        res.json({ success: true, order });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/api/orders/mark_refunded', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database not configured' });
        const { order_id, refund_amount, expected_refunded_amount } = req.body;
        if (typeof order_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id)
            || typeof refund_amount !== 'number' || !Number.isFinite(refund_amount) || refund_amount <= 0
            || typeof expected_refunded_amount !== 'number' || !Number.isFinite(expected_refunded_amount) || expected_refunded_amount < 0) {
            return res.status(400).json({ success: false, error: 'A valid order ID and refund amounts are required' });
        }
        const { data, error } = await supabaseAdmin.rpc('orders_mark_refunded', {
            p_order_id: order_id, p_refund_amount: refund_amount,
            p_expected_refunded_amount: expected_refunded_amount,
            p_user_email: req.user?.username || req.user?.email || req.user?.id || 'system'
        });
        if (error) return res.status(400).json({ success: false, error: error.message || 'Failed to record refund' });
        res.json({ success: true, order: Array.isArray(data) ? data[0] : data });
    } catch (error) {
        console.error('Error recording refund:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
