const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Handle sale checkout: deduct inventory via RPC function
const handleSalesProcess = async (req, res) => {
    try {
        const { items, cash, customer_name, customer_email } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid cart items' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        let user_email = 'system';
        if (req.user) {
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }

        const cartItems = items.map(item => ({ id: item.id, qty: item.qty }));
        const { data, error } = await supabaseAdmin.rpc('pos_process_sale', {
            p_items: cartItems,
            p_cash: cash,
            p_customer_name: customer_name || 'Walk-in',
            p_customer_email: customer_email || null,
            p_user_email: user_email
        });

        if (error) {
            console.error('RPC Error in pos_process_sale:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to process sale'
            });
        }

        // Check for low stock items in background
        try {
            const { checkAndSendLowStockAlerts } = require('../setting/lowStockAlert');
            const alertItems = (data.items || []).map(item => ({
                id: item.id,
                name: item.name,
                deducted: item.qty
            }));
            checkAndSendLowStockAlerts(alertItems).catch(err => {
                console.error('[Low Stock Alert API] Background alert error:', err);
            });
        } catch (alertError) {
            console.error('[Low Stock Alert API] Failed to initiate alert check:', alertError);
        }

        // All items processed successfully
        res.json(data);

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

router.post('/pos/pos_process', isAuthenticated, hasRole(['admin', 'staff']), handleSalesProcess);
router.post('/admin/pos/pos_process', isAuthenticated, hasRole(['admin']), handleSalesProcess);
router.post('/sales/sales_process', isAuthenticated, hasRole(['admin', 'staff']), handleSalesProcess);

module.exports = router;
