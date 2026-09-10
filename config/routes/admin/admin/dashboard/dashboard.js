const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
router.use(require('./dashboard_total_products'));
router.use(require('./dashboard_low_stock'));
router.use(require('./dashboard_sales_total'));
router.use(require('./dashboard_pending_orders'));
router.use(require('./dashboard_recent_activity'));
router.use(require('./dashboard_summary'));

// Protect dashboard route - Admin exclusive
// GET /dashboard & GET /admin/dashboard - Serve dashboard page
const serveDashboard = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../public/admin/admin/dashboard/dashboard.html'));
};

router.get('/dashboard', isAuthenticated, hasRole(['admin']), serveDashboard);
router.get('/admin/dashboard', isAuthenticated, hasRole(['admin']), serveDashboard);

module.exports = router;
