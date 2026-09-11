const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect activity log route - Admin only
const serveActivityLog = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../public/admin/admin/activity-log/activity-log.html'));
};

router.get('/activity-log', isAuthenticated, hasRole(['admin']), serveActivityLog);
router.get('/admin/activity-log', isAuthenticated, hasRole(['admin']), serveActivityLog);
router.get('/transactions', isAuthenticated, hasRole(['admin']), serveActivityLog);

module.exports = router;
