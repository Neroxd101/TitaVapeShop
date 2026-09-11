const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { supabaseAdmin } = require('../../../../database/supabase');

router.get('/api/dashboard/dashboard_sales_total', isAuthenticated, hasRole(['admin']), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });

  const { start_date, end_date } = req.query;
  if ([start_date, end_date].some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value))) ||
      Date.parse(start_date) > Date.parse(end_date)) {
    return res.status(400).json({ success: false, error: 'Invalid dashboard date range' });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_sales_total', { p_start_date: start_date, p_end_date: end_date });
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('dashboard_sales_total error:', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load dashboard data' });
  }
});

module.exports = router;
