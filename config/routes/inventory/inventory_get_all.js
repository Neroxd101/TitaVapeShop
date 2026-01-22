const express = require('express');
const path = require('path');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /inventory - Serve inventory page
router.get('/inventory', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/inventory/inventory.html'));
});

// GET /inventory/inventory_get_all - Get all inventory items
router.get('/inventory/inventory_get_all', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { category, search } = req.query;

        // Call database RPC function directly
        // All filtering and sorting is done in the database
        const { data, error } = await supabase.rpc('inventory_get_all', {
            filter_category: category || null,
            filter_search: search || null
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message || 'Failed to fetch inventory' });
        }

        res.json({ success: true, data: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
