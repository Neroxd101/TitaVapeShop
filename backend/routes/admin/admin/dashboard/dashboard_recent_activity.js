const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
const { supabaseAdmin } = require('../../../../database/supabase');

router.get('/api/dashboard/dashboard_recent_activity', isAuthenticated, hasRole(['admin']), async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });

  try {
    // Use the activity log reader so older cancellation entries get the same
    // recovered order ID, item count and order type on both pages.
    const { data, error } = await supabaseAdmin.rpc('transactions_get_all', {
      p_limit: 14,
      p_offset: 0
    });
    if (error) throw error;
    if (!data?.success || !Array.isArray(data.transactions)) throw new Error('Invalid activity response');
    return res.json({ success: true, data: data.transactions });
  } catch (error) {
    console.error('dashboard_recent_activity error:', error.message);
    return res.status(503).json({ success: false, error: 'Unable to load dashboard data' });
  }
});

module.exports = router;
