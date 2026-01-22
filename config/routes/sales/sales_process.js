const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');

const { isAuthenticated } = require('../../middleware/authMiddleware');

// Protect all sales API routes
router.use(isAuthenticated);

// Handle sale checkout: deduct inventory via Edge Function
router.post('/sales/sales_process', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid cart items' });
        }

        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Call database RPC function
        const { data, error } = await supabase.rpc('sales_process', {
            p_items: items
        });

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to process checkout'
            });
        }

        // RPC function returns JSONB, parse it
        const result = typeof data === 'string' ? JSON.parse(data) : data;

        // Check if data indicates failure
        if (result.success === false) {
            return res.status(400).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
