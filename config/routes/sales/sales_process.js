const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

        // Handle sale checkout: deduct inventory via RPC function
router.post('/sales/sales_process', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        const { items, customer_name, customer_email } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid cart items' });
        }

        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const results = [];
        const errors = [];

        // Process each item individually
        for (const item of items) {
            try {
                const { id, qty, price } = item;

                if (!id || !qty || qty <= 0) {
                    errors.push({
                        id: id || 'unknown',
                        name: item.name || 'Unknown',
                        error: 'Invalid item data: id or qty missing'
                    });
                    continue;
                }

                // Call inventory_complete_sale RPC function for each item
                // Use price from cart item (may differ from inventory sale_price)
                const { data, error } = await supabase.rpc('inventory_complete_sale', {
                    p_id: id,
                    p_qty_sold: qty,
                    p_sale_price: price || null
                });

                if (error) {
                    errors.push({
                        id: id,
                        name: item.name || 'Unknown',
                        error: error.message || 'Failed to process item'
                    });
                    continue;
                }

                // RPC returns an array, get first item
                const updatedItem = Array.isArray(data) && data.length > 0 ? data[0] : data;

                results.push({
                    id: id,
                    name: item.name || updatedItem?.name || 'Unknown',
                    deducted: qty,
                    remaining: updatedItem?.quantity || 0
                });
            } catch (itemError) {
                errors.push({
                    id: item.id || 'unknown',
                    name: item.name || 'Unknown',
                    error: itemError.message || 'Failed to process item'
                });
            }
        }

        // If there are errors, return partial success
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some items failed to process',
                errors: errors,
                processed: results
            });
        }

        // Log transaction for completed sale (server-side, like orders)
        let user_email = 'system';
        if (req.user) {
            user_email = req.user.username || req.user.email || req.user.id || 'system';
        }

        // Calculate total from items
        const saleTotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        
        // Format sale items for transaction log
        const saleItems = items.map(item => ({
            id: item.id,
            qty: item.qty,
            price: item.price,
            name: item.name || 'Unknown'
        }));

        // Log transaction using admin client to bypass RLS
        if (supabaseAdmin) {
            try {
                await supabaseAdmin.rpc('transactions_log', {
                    p_action_type: 'sale_complete',
                    p_user_email: user_email,
                    p_entity_type: 'sale',
                    p_sale_total: saleTotal,
                    p_sale_items: saleItems,
                    p_customer_name: customer_name || 'Walk-in',
                    p_customer_email: customer_email || null,
                    p_details: {
                        items_count: items.length,
                        processed_items: results
                    }
                });
            } catch (logError) {
                // Don't fail the sale if logging fails, just log the error
                console.error('Failed to log transaction:', logError);
            }
        }

        // All items processed successfully
        res.json({
            success: true,
            processed: results
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
