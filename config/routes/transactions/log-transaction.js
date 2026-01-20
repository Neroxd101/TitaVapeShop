const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { isAuthenticated } = require('../../middleware/authMiddleware');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/transactions/log
 * Log a transaction/activity
 */
router.post('/api/transactions/log', isAuthenticated, async (req, res) => {
    try {
        const {
            action_type,
            entity_id,
            entity_type,
            details,
            sale_total,
            sale_items,
            customer_name,
            customer_email
        } = req.body;

        if (!action_type) {
            return res.status(400).json({ error: 'action_type is required' });
        }

        // Get user info from JWT
        let user_email = 'system';

        if (req.user?.username) {
            user_email = req.user.username;
        }

        // Insert transaction
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                action_type,
                user_email,
                entity_id,
                entity_type,
                details,
                sale_total,
                sale_items,
                customer_name,
                customer_email
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging transaction:', error);
            return res.status(500).json({ error: 'Failed to log transaction', details: error.message });
        }

        res.json({ success: true, transaction: data });
    } catch (error) {
        console.error('Error in log transaction:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
