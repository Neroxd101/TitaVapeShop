const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const serveSettings = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/setting/settings.html'));
};

router.get('/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/setting', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/setting', isAuthenticated, hasRole(['admin']), serveSettings);

module.exports = router;
