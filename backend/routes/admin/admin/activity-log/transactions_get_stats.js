const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

/**
 * Get transaction statistics via RPC function
 */
const handleGetStats = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call database RPC function
        const { data, error } = await supabase.rpc('transactions_get_stats', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch stats'
            });
        }

        // RPC returns JSONB directly
        res.json({
            success: true,
            stats: data
        });
    } catch (error) {
        console.error('Error in stats:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.get('/transactions/transactions_get_stats', isAuthenticated, hasRole(['admin']), handleGetStats);
router.get('/activity-log/transactions_get_stats', isAuthenticated, hasRole(['admin']), handleGetStats);

module.exports = router;
