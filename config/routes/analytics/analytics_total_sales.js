/**
 * ============================================
 * ANALYTICS: Total Sales Route
 * ============================================
 * 
 * GET /api/analytics/total-sales
 * Gets total number of sales transactions
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

router.get('/api/analytics/total-sales', isAuthenticated, hasRole(['admin']), async (req, res) => {
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
        const { data, error } = await supabase.rpc('analytics_total_sales', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch total sales'
            });
        }

        res.json({
            success: true,
            salesCount: data ?? 0
        });

    } catch (error) {
        console.error('Error in total sales API:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;
