const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { supabaseAdmin } = require('../../../../database/supabase');

router.get('/api/dashboard/dashboard_total_products', isAuthenticated, hasRole(['admin']), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });

  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_total_products');
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('dashboard_total_products error:', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load dashboard data' });
  }
});

module.exports = router;
