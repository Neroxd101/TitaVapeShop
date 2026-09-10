const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

/**
 * Get list of transactions via RPC function
 */
const handleGetAllTransactions = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_action_type: req.query.action_type || null,
            p_user_email: req.query.user_email || null,
            p_entity_id: req.query.entity_id || null,
            p_limit: parseInt(req.query.limit) || 50,
            p_offset: parseInt(req.query.offset) || 0,
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call database RPC function
        const { data, error } = await supabase.rpc('transactions_get_all', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch transactions'
            });
        }

        // RPC returns JSONB directly
        res.json(data);
    } catch (error) {
        console.error('Error in list transactions:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.get('/transactions/transactions_get_all', isAuthenticated, hasRole(['admin']), handleGetAllTransactions);
router.get('/activity-log/transactions_get_all', isAuthenticated, hasRole(['admin']), handleGetAllTransactions);

module.exports = router;
