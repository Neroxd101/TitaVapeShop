const express = require('express');
const router = express.Router();
const supabase = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// POST /inventory/create-item - Create new item
router.post('/inventory/create-item', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        console.log('Creating item with data:', JSON.stringify(req.body, null, 2));

        const { data, error } = await supabase.functions.invoke('inventory', {
            body: {
                action: 'create',
                ...req.body,
            },
        });

        console.log('Edge function response:', { data, error });

        if (error) {
            console.error('Supabase function error:', error);
            // The Edge Function may have returned error details in data
            if (data && data.error) {
                return res.status(400).json({ success: false, error: data.error });
            }
            return res.status(400).json({ success: false, error: error.message || 'Failed to create item' });
        }

        // Check if data indicates failure
        if (data && data.success === false) {
            return res.status(400).json(data);
        }

        res.status(201).json(data);
    } catch (error) {
        console.error('Inventory create error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
