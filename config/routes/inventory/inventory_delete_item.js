const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
// DELETE /inventory/inventory_delete_item/:id - Delete item
router.delete('/inventory/inventory_delete_item/:id', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Item ID is required' });
        }

        // Call database RPC function
        const { data, error } = await supabase.rpc('inventory_delete_item', {
            p_id: id
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message || 'Failed to delete item' });
        }

        // RPC function returns JSONB, parse it
        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (result.success === false) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
