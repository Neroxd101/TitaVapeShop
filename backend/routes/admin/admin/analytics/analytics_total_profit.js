/**
 * ============================================
 * ANALYTICS: Total Profit Route
 * ============================================
 * 
 * GET /api/analytics/total-profit
 * GET /api/analytics/total-revenue
 * Gets total profit (sale price minus cost price) from all completed sales
 */

const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { getSaleDetails } = require('./analytics_sale_details');

router.get('/api/analytics/sale-details', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const start = new Date(req.query.start_date);
    const end = new Date(req.query.end_date);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
        return res.status(400).json({ success: false, error: 'Choose a valid date range.' });
    }
    // Direct table reads require the server-only service role; the public client
    // silently returns no rows under RLS. Admin authentication is enforced above.
    if (!supabaseAdmin) return res.status(503).json({
        success: false,
        error: 'Sale details are unavailable: the server administrator must configure SUPABASE_SERVICE_ROLE_KEY.'
    });
    // The dashboard RPCs include the entire end day.
    end.setTime(end.getTime() + 86400000);
    try {
        const report = await getSaleDetails(supabaseAdmin, start.toISOString(), end.toISOString());
        res.set('Cache-Control', 'private, no-store');
        res.json({ success: true, report });
    } catch (error) {
        console.error('Analytics sale details failed:', error);
        res.status(500).json({ success: false, error: 'Unable to load sale details. Please try again.' });
    }
});

const getTotalProfitHandler = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call RPC function with fallback if analytics_total_profit isn't created yet in DB
        let result = await supabase.rpc('analytics_total_profit', rpcParams);


        if (result.error) {
            console.error('RPC Error in total profit API:', result.error);
            return res.status(400).json({
                success: false,
                error: result.error.message || 'Failed to fetch total profit'
            });
        }

        const profit = result.data ?? 0;

        res.json({
            success: true,
            totalProfit: profit,
            totalRevenue: profit
        });

    } catch (error) {
        console.error('Error in total profit API:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};

router.get('/api/analytics/total-profit', isAuthenticated, hasRole(['admin']), getTotalProfitHandler);
router.get('/api/analytics/total-revenue', isAuthenticated, hasRole(['admin']), getTotalProfitHandler);

module.exports = router;
