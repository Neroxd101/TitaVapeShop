const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

/**
 * GET /api/analytics/dashboard
 * Get aggregated analytics data via Edge Function
 */
router.get('/api/analytics/dashboard', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Invoke the 'analytics_dashboard' edge function
        const { data, error } = await supabase.functions.invoke('analytics_dashboard', {
            body: {
                ...req.query
            }
        });

        if (error) {
            console.error('Supabase function error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch analytics data'
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in analytics API:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
