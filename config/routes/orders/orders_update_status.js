const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect orders routes
router.use(isAuthenticated, hasRole(['admin']));

// POST /api/orders/update_status - Update order status
router.post('/api/orders/update_status', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { order_id, status } = req.body;

        if (!order_id || !status) {
            return res.status(400).json({
                success: false,
                error: 'order_id and status are required'
            });
        }

        // Get user email from JWT
        let user_email = 'system';
        if (req.user) {
            // Try username first, then email, then id as fallback
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }
        
        // Debug logging
        console.log('Order update - User info:', {
            user: req.user,
            user_email: user_email,
            order_id: order_id,
            status: status
        });

        // Call database RPC function
        const { data, error } = await supabase.rpc('orders_update_status', {
            p_order_id: order_id,
            p_status: status,
            p_user_email: user_email
        });

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update order status'
            });
        }

        res.json({ success: true, order: data });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
