/**
 * ============================================
 * ANALYTICS: Total Revenue Route
 * ============================================
 * 
 * GET /api/analytics/total-revenue
 * Gets total revenue from all sales
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

router.get('/api/analytics/total-revenue', isAuthenticated, hasRole(['admin']), async (req, res) => {
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
        const { data, error } = await supabase.rpc('analytics_total_revenue', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch total revenue'
            });
        }

        res.json({
            success: true,
            totalRevenue: data ?? 0
        });

    } catch (error) {
        console.error('Error in total revenue API:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;
