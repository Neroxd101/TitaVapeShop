const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// DELETE /inventory/delete-item/:id - Delete item
router.delete('/inventory/delete-item/:id', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data, error } = await supabase.functions.invoke('inventory', {
            body: {
                action: 'delete',
                id: req.params.id,
            },
        });

        if (error) {
            console.error('Supabase function error:', error);
            if (data && data.error) {
                return res.status(400).json({ success: false, error: data.error });
            }
            return res.status(400).json({ success: false, error: error.message || 'Failed to delete item' });
        }

        if (data && data.success === false) {
            return res.status(400).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Inventory delete error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
