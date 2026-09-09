/**
 * ============================================
 * ANALYTICS: Total Orders Route
 * ============================================
 * 
 * GET /api/analytics/total-orders
 * Gets total number of completed order/sale transactions
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

const getTotalOrdersHandler = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call RPC function with fallback if analytics_total_orders isn't created yet in DB
        let result = await supabase.rpc('analytics_total_orders', rpcParams);
        if (result.error && result.error.message && result.error.message.includes('analytics_total_orders')) {
            result = await supabase.rpc('analytics_total_sales', rpcParams);
        }

        if (result.error) {
            console.error('RPC Error in total orders API:', result.error);
            return res.status(400).json({
                success: false,
                error: result.error.message || 'Failed to fetch total orders'
            });
        }

        const count = result.data ?? 0;

        res.json({
            success: true,
            totalOrders: count,
            ordersCount: count,
            salesCount: count
        });

    } catch (error) {
        console.error('Error in total orders API:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error', 
            details: error.message 
        });
    }
};

router.get('/api/analytics/total-orders', isAuthenticated, hasRole(['admin']), getTotalOrdersHandler);
router.get('/api/analytics/total-sales', isAuthenticated, hasRole(['admin']), getTotalOrdersHandler);

module.exports = router;
