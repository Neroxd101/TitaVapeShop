/**
 * ============================================
 * ANALYTICS: Total Orders Route
 * ============================================
 * 
 * GET /api/analytics/total-orders
 * Gets total number of completed order/sale transactions via analytics_total_orders RPC
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

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

        // Call RPC function
        const { data, error } = await supabase.rpc('analytics_total_orders', rpcParams);

        if (error) {
            console.error('RPC Error in total orders API:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch total orders'
            });
        }

        const count = data ?? 0;

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
