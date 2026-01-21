const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

/**
 * GET /api/transactions/sales-report
 * Get detailed sales report via Edge Function
 */
router.get('/transactions/transactions_get_report', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Invoke the 'transactions_get_report' edge function
        const { data, error } = await supabase.functions.invoke('transactions_get_report', {
            body: {
                ...req.query
            }
        });

        if (error) {
            console.error('Supabase function error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch sales report'
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in sales report:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
