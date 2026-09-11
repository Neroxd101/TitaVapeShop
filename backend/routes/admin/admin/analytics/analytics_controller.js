const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect analytics route - Admin only
const serveAnalytics = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/analytics/analytics.html'));
};

router.get('/analytics', isAuthenticated, hasRole(['admin']), serveAnalytics);
router.get('/admin/analytics', isAuthenticated, hasRole(['admin']), serveAnalytics);

module.exports = router;
