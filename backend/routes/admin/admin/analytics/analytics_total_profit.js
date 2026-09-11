/**
 * ============================================
 * ANALYTICS: Total Profit Route
 * ============================================
 * 
 * GET /api/analytics/total-profit
 * GET /api/analytics/total-revenue
 * Gets total profit (sale price minus cost price) from all completed sales
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const getTotalProfitHandler = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call RPC function with fallback if analytics_total_profit isn't created yet in DB
        let result = await supabase.rpc('analytics_total_profit', rpcParams);


        if (result.error) {
            console.error('RPC Error in total profit API:', result.error);
            return res.status(400).json({
                success: false,
                error: result.error.message || 'Failed to fetch total profit'
            });
        }

        const profit = result.data ?? 0;

        res.json({
            success: true,
            totalProfit: profit,
            totalRevenue: profit
        });

    } catch (error) {
        console.error('Error in total profit API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

router.get('/api/analytics/total-profit', isAuthenticated, hasRole(['admin']), getTotalProfitHandler);
router.get('/api/analytics/total-revenue', isAuthenticated, hasRole(['admin']), getTotalProfitHandler);

module.exports = router;
