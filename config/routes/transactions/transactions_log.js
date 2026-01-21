const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated } = require('../../middleware/authMiddleware');

/**
 * POST /api/transactions/log
 * Log a transaction/activity via Edge Function
 */
router.post('/transactions/transactions_log', isAuthenticated, async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Get user info from JWT
        let user_email = 'system';
        if (req.user?.username) {
            user_email = req.user.username;
        }

        // Invoke the 'transactions_log' edge function
        const { data, error } = await supabase.functions.invoke('transactions_log', {
            body: {
                ...req.body,
                user_email
            }
        });

        if (error) {
            console.error('Supabase function error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to log transaction'
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in log transaction:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
