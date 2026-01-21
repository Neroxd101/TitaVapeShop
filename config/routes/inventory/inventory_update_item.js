const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// PUT /inventory/inventory_update_item - Update item
router.put('/inventory/inventory_update_item', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data, error } = await supabase.functions.invoke('inventory_update_item', {
            body: {
                ...req.body,
            },
        });

        if (error) {
            if (data && data.error) {
                return res.status(400).json({ success: false, error: data.error });
            }
            return res.status(400).json({ success: false, error: error.message || 'Failed to update item' });
        }

        if (data && data.success === false) {
            return res.status(400).json(data);
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
