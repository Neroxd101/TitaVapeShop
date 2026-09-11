const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect orders routes
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /api/orders/get_all - Get all orders
router.get('/api/orders/get_all', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        const { status, limit, offset, search, start_date, end_date } = req.query;
        const parsedLimit = parseInt(limit) || 20;
        const parsedOffset = parseInt(offset) || 0;
        const client = supabaseAdmin || supabase;

        // If a search term is provided, filter across order fields & items
        if (search && search.trim()) {
            const cleanSearch = search.trim();
            const searchLower = cleanSearch.toLowerCase().replace(/^#/, '');

            let query = client.from('orders').select('*');
            if (status) {
                query = query.eq('status', status);
            }
            if (start_date) {
                const startIso = start_date.includes('T') ? start_date : new Date(start_date + 'T00:00:00').toISOString();
                query = query.gte('created_at', startIso);
            }
            if (end_date) {
                const endIso = end_date.includes('T') ? end_date : new Date(end_date + 'T23:59:59.999').toISOString();
                query = query.lte('created_at', endIso);
            }
            query = query.order('created_at', { ascending: false });

            const { data: allOrders, error } = await query;
            if (error) {
                console.error('Supabase query error:', error);
                return res.status(400).json({
                    success: false,
                    error: error.message || 'Failed to fetch orders'
                });
            }

            const matchedOrders = (allOrders || []).filter(order => {
                // 1. Order ID (supports partial prefix like 8-char display or full UUID)
                if (order.id && order.id.toLowerCase().includes(searchLower)) {
                    return true;
                }
                // 2. Customer Name
                if (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) {
                    return true;
                }
                // 3. Contact Number
                if (order.contact_number && order.contact_number.toLowerCase().includes(searchLower)) {
                    return true;
                }
                // 4. Customer Email
                if (order.customer_email && order.customer_email.toLowerCase().includes(searchLower)) {
                    return true;
                }
                // 5. Items in order (item name or category)
                if (Array.isArray(order.items)) {
                    const itemMatch = order.items.some(item => {
                        if (!item) return false;
                        const name = (item.name || item.product_name || '').toLowerCase();
                        const cat = (item.category || '').toLowerCase();
                        return name.includes(searchLower) || cat.includes(searchLower);
                    });
                    if (itemMatch) return true;
                }
                return false;
            });

            const total = matchedOrders.length;
            const pagedOrders = matchedOrders.slice(parsedOffset, parsedOffset + parsedLimit);

            return res.json({
                success: true,
                orders: pagedOrders,
                total: total,
                limit: parsedLimit,
                offset: parsedOffset
            });
        }

        // If date filters are provided without search, use direct query with exact count
        if (start_date || end_date) {
            let query = client.from('orders').select('*', { count: 'exact' });
            if (status) query = query.eq('status', status);
            if (start_date) {
                const startIso = start_date.includes('T') ? start_date : new Date(start_date + 'T00:00:00').toISOString();
                query = query.gte('created_at', startIso);
            }
            if (end_date) {
                const endIso = end_date.includes('T') ? end_date : new Date(end_date + 'T23:59:59.999').toISOString();
                query = query.lte('created_at', endIso);
            }
            query = query.order('created_at', { ascending: false })
                         .range(parsedOffset, parsedOffset + parsedLimit - 1);

            const { data: dateData, count, error: dateError } = await query;
            if (dateError) {
                console.error('Date filter query error:', dateError);
                return res.status(400).json({ success: false, error: dateError.message });
            }
            return res.json({
                success: true,
                orders: dateData || [],
                total: count || 0,
                limit: parsedLimit,
                offset: parsedOffset
            });
        }

        // Call database RPC function when no search and no date query
        const { data, error } = await client.rpc('orders_get_all', {
            p_status: status || null,
            p_limit: parsedLimit,
            p_offset: parsedOffset
        });

        if (error) {
            console.error('RPC Error, falling back to direct query:', error);
            let query = client.from('orders').select('*', { count: 'exact' });
            if (status) query = query.eq('status', status);
            query = query.order('created_at', { ascending: false })
                         .range(parsedOffset, parsedOffset + parsedLimit - 1);
            const { data: fallbackData, count, error: fallbackError } = await query;
            if (fallbackError) {
                return res.status(400).json({ success: false, error: fallbackError.message });
            }
            return res.json({
                success: true,
                orders: fallbackData || [],
                total: count || 0,
                limit: parsedLimit,
                offset: parsedOffset
            });
        }

        // Extract total count from first row if available
        const total = data && data.length > 0 ? data[0].total_count : 0;
        const orders = data || [];

        res.json({
            success: true,
            orders: orders,
            total: total,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
