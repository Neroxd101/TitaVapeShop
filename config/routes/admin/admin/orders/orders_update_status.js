const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { sendOrderEmail } = require('./orders_email');

// Protect orders routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// POST /api/orders/update_status - Update order status
router.post('/api/orders/update_status', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { order_id, status, reason } = req.body;
        if (status === 'voided' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000)) {
            return res.status(400).json({ success: false, error: 'A void reason of 1–1000 characters is required.' });
        }
        if (status === 'voided' && !supabaseAdmin) {
            return res.status(503).json({ success: false, error: 'Order voiding requires the server database service key.' });
        }

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

        // Call database RPC function
        const { data, error } = status === 'voided' ? await supabaseAdmin.rpc('orders_void', {
            p_order_id: order_id,
            p_reason: reason.trim(),
            p_user_email: user_email
        }) : await supabase.rpc('orders_update_status', {
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

        // Get the updated order (RPC returns array)
        const updatedOrder = Array.isArray(data) && data.length > 0 ? data[0] : data;

        // Send email notification if status is confirmed or completed
        if (updatedOrder && (status === 'confirmed' || status === 'completed')) {
            try {
                await sendOrderEmail(
                    updatedOrder.customer_email,
                    updatedOrder.customer_name,
                    updatedOrder.id,
                    status,
                    {
                        items: updatedOrder.items,
                        total_amount: updatedOrder.total_amount,
                        order_type: updatedOrder.order_type
                    }
                );
            } catch (emailError) {
                console.error('[Order Update] Error sending email:', emailError);
                // Don't fail the status update if email fails
            }
        }

        // Trigger low stock check if order is completed
        if (updatedOrder && status === 'completed' && updatedOrder.items && Array.isArray(updatedOrder.items)) {
            try {
                const { checkAndSendLowStockAlerts } = require('../setting/lowStockAlert');
                const alertItems = updatedOrder.items.map(item => ({
                    id: item.id,
                    name: item.name || 'Unknown Item',
                    deducted: parseInt(item.quantity, 10) || 0
                }));
                checkAndSendLowStockAlerts(alertItems).catch(err => {
                    console.error('[Low Stock Alert API] Background alert error for completed order:', err);
                });
            } catch (alertError) {
                console.error('[Low Stock Alert API] Failed to initiate alert check for completed order:', alertError);
            }
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
