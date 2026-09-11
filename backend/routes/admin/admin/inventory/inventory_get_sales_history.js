const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect all inventory routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /inventory/inventory_get_sales_history/:id - Get sales history for an item
router.get('/inventory/inventory_get_sales_history/:id', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        if (!id) {
            return res.status(400).json({ success: false, error: 'Item ID is required' });
        }

        const rpcParams = {
            p_item_id: id,
            p_limit: limit,
            p_offset: offset
        };
        if (startDate) rpcParams.p_start_date = startDate;
        if (endDate) rpcParams.p_end_date = endDate;

        // Call database RPC function
        const { data, error } = await supabase.rpc('inventory_get_sales_history', rpcParams);

        if (error) {
            console.error('RPC Error:', error);
            return res.status(400).json({ success: false, error: error.message || 'Failed to get sales history' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error in get sales history:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
