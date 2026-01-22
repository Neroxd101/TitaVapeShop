const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// POST /inventory/inventory_create_item - Create new item
router.post('/inventory/inventory_create_item', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { category, name, description, quantity, cost_price, sale_price, qr_image_url, images } = req.body;

        // Validate required fields
        if (!category || !name) {
            return res.status(400).json({ success: false, error: 'Category and name are required' });
        }

        // Call database RPC function
        const { data, error } = await supabase.rpc('inventory_create_item', {
            p_category: category,
            p_name: name,
            p_description: description || null,
            p_quantity: quantity || 0,
            p_cost_price: cost_price || 0,
            p_sale_price: sale_price || 0,
            p_qr_image_url: qr_image_url || null,
            p_images: images || []
        });

        if (error) {
            console.error('RPC Error:', error);
            console.error('RPC Params:', { p_category: category, p_name: name, p_description: description, p_quantity: quantity, p_cost_price: cost_price, p_sale_price: sale_price, p_qr_image_url: qr_image_url, p_images: images });
            const errorMessage = error.message || error.details || error.hint || 'Failed to create item';
            return res.status(400).json({ success: false, error: errorMessage });
        }

        // RPC functions return an array, get the first item
        const createdItem = Array.isArray(data) && data.length > 0 ? data[0] : data;

        res.status(201).json({ success: true, data: createdItem });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
