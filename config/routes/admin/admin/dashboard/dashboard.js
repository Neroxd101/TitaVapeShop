const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect dashboard route - Admin exclusive
// GET /dashboard & GET /admin/dashboard - Serve dashboard page
const serveDashboard = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../public/admin/admin/dashboard/dashboard.html'));
};

router.get('/dashboard', isAuthenticated, hasRole(['admin']), serveDashboard);
router.get('/admin/dashboard', isAuthenticated, hasRole(['admin']), serveDashboard);

module.exports = router;
