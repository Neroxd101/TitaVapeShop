const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect orders routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /api/orders/get_all - Get all orders
router.get('/api/orders/get_all', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { status, limit, offset } = req.query;

        // Call database RPC function
        const { data, error } = await supabase.rpc('orders_get_all', {
            p_status: status || null,
            p_limit: parseInt(limit) || 50,
            p_offset: parseInt(offset) || 0
        });

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch orders'
            });
        }

        // Extract total count from first row if available
        const total = data && data.length > 0 ? data[0].total_count : 0;
        const orders = data || [];

        res.json({
            success: true,
            orders: orders,
            total: total,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
