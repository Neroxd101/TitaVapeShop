const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// GET /api/analytics/items-sold-details
router.get('/api/analytics/items-sold-details', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        const { data, error } = await supabaseAdmin.rpc('analytics_modal_items_sold', rpcParams);

        if (error) {
            console.error('RPC Error in items sold details API:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch items sold details'
            });
        }

        res.set('Cache-Control', 'private, no-store');
        res.json({
            success: true,
            rpcData: data
        });

    } catch (error) {
        console.error('Error in items sold details API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

module.exports = router;
