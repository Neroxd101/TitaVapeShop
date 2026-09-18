/**
 * ============================================
 * ANALYTICS: Revenue Trend Route
 * ============================================
 * 
 * GET /api/analytics/sales-trend
 * Gets daily sales and profit grouped by date for trend analysis
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/api/analytics/sales-trend', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call RPC function
        const { data, error } = await supabaseAdmin.rpc('analytics_sales_trend', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch revenue trend'
            });
        }

        res.json({
            success: true,
            salesTrend: data ?? []
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
