const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/transactions/stats
 * Get transaction statistics
 */
router.get('/api/transactions/stats', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let query = supabase.from('transactions').select('action_type, sale_total, created_at');

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching stats:', error);
            return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
        }

        // Calculate statistics
        const stats = {
            total_transactions: data.length,
            inventory_adds: data.filter(t => t.action_type === 'inventory_add').length,
            inventory_edits: data.filter(t => t.action_type === 'inventory_edit').length,
            inventory_deletes: data.filter(t => t.action_type === 'inventory_delete').length,
            sales_completed: data.filter(t => t.action_type === 'sale_complete').length,
            sales_voided: data.filter(t => t.action_type === 'sale_void').length,
            total_sales_amount: data
                .filter(t => t.action_type === 'sale_complete' && t.sale_total)
                .reduce((sum, t) => sum + parseFloat(t.sale_total), 0)
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error in stats:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
