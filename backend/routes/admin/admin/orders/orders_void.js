const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect orders routes - Admin and Staff
router.use(isAuthenticated, hasRole(['admin', 'staff']));

/**
 * POST /api/orders/void - Void an order (1-to-1 RPC to orders_void)
 */
router.post('/api/orders/void', async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(503).json({ success: false, error: 'Order voiding requires the server database service key.' });
        }

        const { order_id, reason } = req.body;

        if (!order_id) {
            return res.status(400).json({
                success: false,
                error: 'order_id is required'
            });
        }

        if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
            return res.status(400).json({
                success: false,
                error: 'A void reason of 1–1000 characters is required.'
            });
        }

        // Get user identifier from JWT
        let user_email = 'system';
        if (req.user) {
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }

        // Call database RPC function orders_void 1-to-1
        const { data, error } = await supabaseAdmin.rpc('orders_void', {
            p_order_id: order_id,
            p_reason: reason.trim(),
            p_user_email: user_email
        });

        if (error) {
            console.error('RPC Error in orders_void:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to void order'
            });
        }

        const updatedOrder = Array.isArray(data) && data.length > 0 ? data[0] : data;

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Error voiding order:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
