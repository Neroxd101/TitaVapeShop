const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/transactions/log
 * Log a transaction/activity
 */
router.post('/log', async (req, res) => {
    try {
        const {
            action_type,
            entity_id,
            entity_type,
            details,
            sale_total,
            sale_items,
            customer_name,
            customer_email
        } = req.body;

        if (!action_type) {
            return res.status(400).json({ error: 'action_type is required' });
        }

        // Get user email from session or auth header
        let user_email = 'system';

        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (!error && user) {
                user_email = user.email;
            }
        } else if (req.session?.user?.email) {
            // Fallback to session if available
            user_email = req.session.user.email;
        }

        // Get IP and user agent
        const ip_address = req.ip || req.connection.remoteAddress;
        const user_agent = req.get('user-agent');

        // Insert transaction
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                action_type,
                user_email,
                entity_id,
                entity_type,
                details,
                sale_total,
                sale_items,
                customer_name,
                customer_email,
                ip_address,
                user_agent
            })
            .select()
            .single();

        if (error) {
            console.error('Error logging transaction:', error);
            return res.status(500).json({ error: 'Failed to log transaction', details: error.message });
        }

        res.json({ success: true, transaction: data });
    } catch (error) {
        console.error('Error in log transaction:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * GET /api/transactions/list
 * Get list of transactions with filters
 */
router.get('/list', async (req, res) => {
    try {
        const {
            action_type,
            user_email,
            entity_id,
            limit = 50,
            offset = 0,
            start_date,
            end_date
        } = req.query;

        let query = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Apply filters
        if (action_type) {
            query = query.eq('action_type', action_type);
        }

        if (user_email) {
            query = query.eq('user_email', user_email);
        }

        if (entity_id) {
            query = query.eq('entity_id', entity_id);
        }

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        // Pagination
        query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            return res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
        }

        res.json({
            success: true,
            transactions: data,
            total: count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error in list transactions:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * GET /api/transactions/stats
 * Get transaction statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let query = supabase.from('transactions').select('action_type, sale_total, created_at');

        if (start_date) {
            query = query.gte('created_at', start_date);
        }

        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching stats:', error);
            return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
        }

        // Calculate statistics
        const stats = {
            total_transactions: data.length,
            inventory_adds: data.filter(t => t.action_type === 'inventory_add').length,
            inventory_edits: data.filter(t => t.action_type === 'inventory_edit').length,
            inventory_deletes: data.filter(t => t.action_type === 'inventory_delete').length,
            sales_completed: data.filter(t => t.action_type === 'sale_complete').length,
            sales_voided: data.filter(t => t.action_type === 'sale_void').length,
            total_sales_amount: data
                .filter(t => t.action_type === 'sale_complete' && t.sale_total)
                .reduce((sum, t) => sum + parseFloat(t.sale_total), 0)
        };

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error in stats:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

/**
 * GET /api/transactions/sales-report
 * Get detailed sales report
 */
router.get('/sales-report', async (req, res) => {
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
