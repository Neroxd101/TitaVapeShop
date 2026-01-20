const express = require('express');
const router = express.Router();
const { supabase } = require('../../database/supabase');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

/**
 * GET /api/transactions/sales-report
 * Get detailed sales report
 */
router.get('/api/transactions/sales-report', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const { start_date, end_date, group_by = 'day' } = req.query;

        let query = supabase
            .from('transactions')
            .select('sale_total, sale_items, customer_name, customer_email, created_at')
            .eq('action_type', 'sale_complete')
            .order('created_at', { ascending: false });

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching sales report:', error);
            return res.status(500).json({ error: 'Failed to fetch sales report', details: error.message });
        }

        // Calculate totals
        const total_sales = data.reduce((sum, sale) => sum + parseFloat(sale.sale_total || 0), 0);
        const total_transactions = data.length;

        // Get top selling items
        const itemCounts = {};
        data.forEach(sale => {
            if (sale.sale_items && Array.isArray(sale.sale_items)) {
                sale.sale_items.forEach(item => {
                    if (!itemCounts[item.name]) {
                        itemCounts[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                    }
                    itemCounts[item.name].quantity += item.qty;
                    itemCounts[item.name].revenue += item.qty * item.price;
                });
            }
        });

        const top_items = Object.values(itemCounts)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        res.json({
            success: true,
            report: {
                total_sales,
                total_transactions,
                average_sale: total_transactions > 0 ? total_sales / total_transactions : 0,
                top_items,
                sales: data
            }
        });
    } catch (error) {
        console.error('Error in sales report:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
