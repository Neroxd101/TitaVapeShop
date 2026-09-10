const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { supabaseAdmin } = require('../../../../database/supabase');

router.get('/api/dashboard/dashboard_summary', isAuthenticated, hasRole(['admin']), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });
  const { start_date, end_date, month_start } = req.query;
  if ([start_date, end_date, month_start].some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value))) ||
      Date.parse(month_start) > Date.parse(start_date) || Date.parse(start_date) > Date.parse(end_date)) {
    return res.status(400).json({ success: false, error: 'Invalid dashboard date range' });
  }
  try {
    const results = await Promise.all([
      supabaseAdmin.rpc('dashboard_total_products'),
      supabaseAdmin.rpc('dashboard_low_stock'),
      supabaseAdmin.rpc('dashboard_sales_total', { p_start_date: start_date, p_end_date: end_date }),
      supabaseAdmin.rpc('dashboard_sales_total', { p_start_date: month_start, p_end_date: end_date }),
      supabaseAdmin.rpc('dashboard_pending_orders'),
      supabaseAdmin.rpc('dashboard_recent_activity')
    ]);
    const failed = results.find(result => result.error);
    if (failed) throw failed.error;
    const [total, stock, today, month, pending, activity] = results.map(result => result.data);
    return res.json({ success: true, data: {
      inventory: { total, low_stock_count: stock.count, low_stock_items: stock.items },
      today: { total_sales_amount: today },
      month: { total_sales_amount: month },
      pending_orders: pending,
      transactions: activity
    } });
  } catch (error) {
    console.error('dashboard_summary error:', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load dashboard data' });
  }
});

module.exports = router;
