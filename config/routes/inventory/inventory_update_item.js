const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
// PUT /inventory/inventory_update_item - Update item
router.put('/inventory/inventory_update_item', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { id, category, name, description, quantity, cost_price, sale_price, qr_image_url, images } = req.body;

        // Validate required fields
        if (!id) {
            return res.status(400).json({ success: false, error: 'Item ID is required' });
        }

        // Build RPC parameters - only include defined values, convert undefined to null
        const rpcParams = { p_id: id };
        if (category !== undefined) rpcParams.p_category = category || null;
        if (name !== undefined) rpcParams.p_name = name || null;
        if (description !== undefined) rpcParams.p_description = description || null;
        if (quantity !== undefined) rpcParams.p_quantity = quantity !== null && quantity !== undefined ? quantity : null;
        if (cost_price !== undefined) rpcParams.p_cost_price = cost_price !== null && cost_price !== undefined ? cost_price : null;
        if (sale_price !== undefined) rpcParams.p_sale_price = sale_price !== null && sale_price !== undefined ? sale_price : null;
        if (qr_image_url !== undefined) rpcParams.p_qr_image_url = qr_image_url || null;
        if (images !== undefined) rpcParams.p_images = images || null;

        // Call database RPC function
        const { data, error } = await supabase.rpc('inventory_update_item', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({ success: false, error: error.message || 'Failed to update item' });
        }

        // RPC functions return an array, get the first item
        const updatedItem = Array.isArray(data) && data.length > 0 ? data[0] : data;

        res.json({ success: true, data: updatedItem });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
