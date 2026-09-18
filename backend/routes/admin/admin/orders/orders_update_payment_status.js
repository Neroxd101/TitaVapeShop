const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.post('/api/orders/update_payment_status', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { order_id, payment_status } = req.body;
        if (!order_id || !payment_status) {
            return res.status(400).json({ success: false, error: 'order_id and payment_status are required' });
        }

        const userEmail = req.user?.username || req.user?.email || req.user?.id || 'system';
        const { data, error } = await supabaseAdmin.rpc('orders_update_payment_status', {
            p_order_id: order_id,
            p_payment_status: payment_status,
            p_user_email: userEmail
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

module.exports = router;
