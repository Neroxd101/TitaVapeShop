/**
 * ============================================
 * ANALYTICS: Revenue Trend Route
 * ============================================
 * 
 * GET /api/analytics/revenue-trend
 * Gets daily revenue grouped by date for trend analysis
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

router.get('/api/analytics/revenue-trend', isAuthenticated, hasRole(['admin']), async (req, res) => {
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
        const { data, error } = await supabase.rpc('analytics_revenue_trend', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch revenue trend'
            });
        }

        res.json({
            success: true,
            dailyRevenue: data ?? []
        });

    } catch (error) {
        console.error('Error in revenue trend API:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;
