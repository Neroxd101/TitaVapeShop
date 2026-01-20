const express = require('express');
const path = require('path');
const router = express.Router();
const supabase = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /inventory - Serve inventory page
router.get('/inventory', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/inventory/inventory.html'));
});

// GET /inventory/load-items - Get all inventory items
router.get('/inventory/load-items', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { data, error } = await supabase.functions.invoke('inventory', {
            body: {
                action: 'list',
                category: req.query.category,
                search: req.query.search,
            },
        });

        if (error) {
            console.error('Supabase function error:', error);
            // Check if the data contains the actual response
            if (data && typeof data === 'object') {
                return res.status(400).json(data);
            }
            return res.status(400).json({ success: false, error: error.message || 'Failed to fetch inventory' });
        }

        res.json(data);
    } catch (error) {
        console.error('Inventory fetch error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
