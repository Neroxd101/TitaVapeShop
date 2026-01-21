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

        // Invoke the 'sales-process' edge function
        const { data, error } = await supabase.functions.invoke('sales_process', {
            body: { items }
        });

        if (error) {
            console.error('Supabase function error:', error);
            // Handle cases where data might contain error details
            if (data && (data.error || data.errors)) {
                return res.status(400).json(data);
            }
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to process checkout'
            });
        }

        // Check if data indicates failure (data is the response body from edge function)
        if (data && data.success === false) {
            return res.status(400).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
