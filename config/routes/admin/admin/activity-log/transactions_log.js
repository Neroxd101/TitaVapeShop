const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

/**
 * Log a transaction/activity via RPC function
 * Allow any authenticated user (admin/staff) to log transactions
 */
const handleLogTransaction = async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Get user info from JWT (match the logic from orders_update_status)
        let user_email = 'system';
        if (req.user) {
            // Try username first, then email, then id as fallback
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }

        // Validate required fields
        const { action_type } = req.body;
        if (!action_type) {
            return res.status(400).json({
                success: false,
                error: 'action_type is required'
            });
        }

        // Build RPC parameters
        const rpcParams = {
            p_action_type: action_type,
            p_user_email: user_email,
            p_entity_id: req.body.entity_id || null,
            p_entity_type: req.body.entity_type || null,
            p_details: req.body.details || null,
            p_sale_total: req.body.sale_total || null,
            p_sale_items: req.body.sale_items || null,
            p_customer_name: req.body.customer_name || null,
            p_customer_email: req.body.customer_email || null
        };

        // Call database RPC function using admin client to bypass RLS on transactions table
        const { data, error } = await supabaseAdmin.rpc('transactions_log', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to log transaction'
            });
        }

        // RPC functions return an array, get the first item
        const transaction = Array.isArray(data) && data.length > 0 ? data[0] : data;

        res.json({
            success: true,
            transaction: transaction
        });
    } catch (error) {
        console.error('Error in log transaction:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.post('/transactions/transactions_log', isAuthenticated, handleLogTransaction);
router.post('/activity-log/transactions_log', isAuthenticated, handleLogTransaction);

module.exports = router;
