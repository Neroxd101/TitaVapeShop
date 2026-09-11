const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect orders routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /api/orders/get_all - Get all orders (1-to-1 RPC)
router.get('/api/orders/get_all', async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        if (!client) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { status, limit, offset, search, start_date, end_date } = req.query;
        const parsedLimit = parseInt(limit) || 20;
        const parsedOffset = parseInt(offset) || 0;

        // Clean parameters
        const cleanSearch = search && search.trim() ? search.trim() : null;
        let startIso = null;
        let endIso = null;

        if (start_date) {
            startIso = start_date.includes('T') ? start_date : new Date(start_date + 'T00:00:00').toISOString();
        }
        if (end_date) {
            endIso = end_date.includes('T') ? end_date : new Date(end_date + 'T23:59:59.999').toISOString();
        }

        // Call database RPC function 1-to-1
        const { data, error } = await client.rpc('orders_get_all', {
            p_status: status || null,
            p_limit: parsedLimit,
            p_offset: parsedOffset,
            p_search: cleanSearch,
            p_start_date: startIso,
            p_end_date: endIso
        });

        if (error) {
            console.error('RPC Error in orders_get_all:', error);
            return res.status(400).json({ success: false, error: error.message || 'Failed to fetch orders' });
        }

        const orders = data || [];
        const total = orders.length > 0 ? parseInt(orders[0].total_count) || 0 : 0;

        res.json({
            success: true,
            orders: orders,
            total: total,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
