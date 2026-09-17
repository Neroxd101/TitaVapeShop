const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// GET /api/analytics/gross-sales-details
router.get('/api/analytics/gross-sales-details', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        const { data, error } = await supabase.rpc('analytics_modal_gross_sales', rpcParams);

        if (error) {
            console.error('RPC Error in gross sales details API:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch gross sales details'
            });
        }

        res.set('Cache-Control', 'private, no-store');
        res.json({
            success: true,
            rpcData: data
        });

    } catch (error) {
        console.error('Error in gross sales details API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});


module.exports = router;
