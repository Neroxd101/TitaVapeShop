const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect analytics route - Admin only
// GET /analytics - Serve analytics page
router.get('/analytics', isAuthenticated, hasRole(['admin']), (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/analytics/analytics.html'));
});

module.exports = router;
