const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// GET /api/analytics/total-orders-details
router.get('/api/analytics/total-orders-details', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        const { data, error } = await supabaseAdmin.rpc('analytics_modal_total_orders', rpcParams);

        if (error) {
            console.error('RPC Error in total orders details API:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch total orders details'
            });
        }

        res.set('Cache-Control', 'private, no-store');
        res.json({
            success: true,
            rpcData: data
        });

    } catch (error) {
        console.error('Error in total orders details API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});


module.exports = router;
