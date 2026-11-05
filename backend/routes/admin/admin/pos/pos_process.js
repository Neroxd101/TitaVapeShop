const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Handle sale checkout: deduct inventory via RPC function
const handleSalesProcess = async (req, res) => {
    try {
        const { items, cash, customer_name, customer_email,
            payment_method = 'cash', payment_reference, payment_proof } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid cart items' });
        }

        if (!['cash', 'online'].includes(payment_method)
            || (payment_reference != null && (typeof payment_reference !== 'string' || payment_reference.length > 100))
            || (payment_proof != null && (typeof payment_proof !== 'string' || payment_proof.length > 2048
                || !/^https:\/\/res\.cloudinary\.com\/titavapeshop\/image\/upload\/[A-Za-z0-9_./%-]+$/.test(payment_proof)))) {
            return res.status(400).json({ success: false, error: 'Invalid payment details' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        let user_email = 'system';
        if (req.user) {
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }

        const cartItems = items.map(item => ({
            id: item.id,
            qty: item.qty,
            selected_variation: typeof item.selected_variation === 'string' ? item.selected_variation.trim() : null
        }));
        const { data, error } = await supabaseAdmin.rpc('pos_process_sale', {
            p_items: cartItems,
            p_cash: cash,
            p_customer_name: customer_name || 'Walk-in',
            p_customer_email: customer_email || null,
            p_user_email: user_email,
            ...(payment_method === 'online' && {
                p_payment_method: payment_method,
                p_payment_reference: payment_reference?.trim() || null,
                p_payment_proof: payment_proof || null
            })
        });

        if (error) {
            console.error('RPC Error in pos_process_sale:', error);
            if (payment_method === 'online' && error.code === 'PGRST202') {
                return res.status(503).json({
                    success: false,
                    error: 'Online checkout is unavailable until the POS database update is applied. The sale was not recorded.'
                });
            }
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
