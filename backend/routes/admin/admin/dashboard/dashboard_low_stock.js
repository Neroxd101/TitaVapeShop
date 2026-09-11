const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { supabaseAdmin } = require('../../../../database/supabase');

router.get('/api/dashboard/dashboard_low_stock', isAuthenticated, hasRole(['admin']), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });

  try {
    const { data, error } = await supabaseAdmin.rpc('dashboard_low_stock');
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('dashboard_low_stock error:', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load dashboard data' });
  }
});

module.exports = router;
