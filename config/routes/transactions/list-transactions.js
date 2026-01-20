const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET /api/transactions/list
 * Get list of transactions with filters
 */
router.get('/api/transactions/list', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const {
            action_type,
            user_email,
            entity_id,
            limit = 50,
            offset = 0,
            start_date,
            end_date
        } = req.query;

        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Apply filters
        if (action_type) {
            query = query.eq('action_type', action_type);
        }

        if (user_email) {
            query = query.eq('user_email', user_email);
        }

        if (entity_id) {
            query = query.eq('entity_id', entity_id);
        }

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        // Pagination
        query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            return res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
        }

        res.json({
            success: true,
            transactions: data,
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error in list transactions:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
