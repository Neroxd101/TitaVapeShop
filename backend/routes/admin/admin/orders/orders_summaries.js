const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// GET /orders/orders_summaries - Return database-computed KPI counters for orders
router.get('/orders/orders_summaries', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database client not configured' });
        }

        const { data, error } = await supabaseAdmin.rpc('orders_summaries');

        if (error) {
            console.error('orders_summaries rpc error:', error.message);
            return res.status(400).json({ success: false, error: 'Failed to fetch order summaries' });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('orders_summaries route error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
