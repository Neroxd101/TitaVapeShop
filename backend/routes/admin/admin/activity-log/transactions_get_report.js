const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

/**
 * Get detailed sales report via RPC function
 */
const handleGetReport = async (req, res) => {
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
        const { data, error } = await supabase.rpc('transactions_get_report', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch sales report'
            });
        }

        // RPC returns JSONB directly
        res.json(data);
    } catch (error) {
        console.error('Error in sales report:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.get('/transactions/transactions_get_report', isAuthenticated, hasRole(['admin']), handleGetReport);
router.get('/activity-log/transactions_get_report', isAuthenticated, hasRole(['admin']), handleGetReport);

module.exports = router;
