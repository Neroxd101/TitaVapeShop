/**
 * ============================================
 * ANALYTICS: Average Basket Route
 * ============================================
 * 
 * GET /api/analytics/avg-basket
 * Gets average sale amount per transaction
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

router.get('/api/analytics/avg-basket', isAuthenticated, hasRole(['admin']), async (req, res) => {
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
        const { data, error } = await supabase.rpc('analytics_avg_basket', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch average basket'
            });
        }

        res.json({
            success: true,
            averageSale: data ?? 0
        });

    } catch (error) {
        console.error('Error in average basket API:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;
