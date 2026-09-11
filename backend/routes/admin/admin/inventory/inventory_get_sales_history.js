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
        let { data, error } = await supabase.rpc('inventory_get_sales_history', rpcParams);

        // Fallback if RPC signature in database hasn't been updated with date parameters yet
        if (error && (startDate || endDate)) {
            console.warn('RPC with date params failed, falling back to 3-param RPC:', error.message);
            const fallbackResult = await supabase.rpc('inventory_get_sales_history', {
                p_item_id: id,
                p_limit: 1000,
                p_offset: 0
            });
            if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.sales) {
                let sales = fallbackResult.data.sales;
                if (startDate) {
                    const s = new Date(startDate);
                    sales = sales.filter(item => new Date(item.sale_date) >= s);
                }
                if (endDate) {
                    const e = new Date(endDate);
                    sales = sales.filter(item => new Date(item.sale_date) <= e);
                }
                const total = sales.length;
                const paginatedSales = sales.slice(offset, offset + limit);
                return res.json({
                    success: true,
                    sales: paginatedSales,
                    total: total,
                    limit: limit,
                    offset: offset
                });
            }
        }

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
