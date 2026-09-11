/**
 * ============================================
 * ANALYTICS: Gross Sales Route
 * ============================================
 * 
 * GET /api/analytics/gross-sales
 * GET /api/analytics/avg-basket (alias)
 * Gets total gross sales from all completed sales via analytics_gross_sales RPC
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const getGrossSalesHandler = async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // Call RPC function
        const { data, error } = await supabase.rpc('analytics_gross_sales', rpcParams);

        if (error) {
            console.error('RPC Error in gross sales API:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to fetch gross sales'
            });
        }

        const grossSales = data ?? 0;

        res.json({
            success: true,
            grossSales: grossSales,
            averageSale: grossSales
        });

    } catch (error) {
        console.error('Error in gross sales API:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error', 
            details: error.message 
        });
    }
};

router.get('/api/analytics/gross-sales', isAuthenticated, hasRole(['admin']), getGrossSalesHandler);
router.get('/api/analytics/avg-basket', isAuthenticated, hasRole(['admin']), getGrossSalesHandler);

module.exports = router;
