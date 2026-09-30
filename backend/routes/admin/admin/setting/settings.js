const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const serveSettings = (req, res) => {
    const roles = Array.isArray(req.user.roles)
        ? req.user.roles : String(req.user.roles || '').split(',').map(role => role.trim());
    const settingsPage = roles.includes('admin')
        ? 'admin/admin/setting/settings.html' : 'admin/staff/setting/settings.html';
    res.sendFile(path.join(__dirname, '../../../../../frontend', settingsPage));
};

router.get('/settings', isAuthenticated, hasRole(['admin', 'staff']), serveSettings);
router.get('/admin/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/setting', isAuthenticated, hasRole(['admin', 'staff']), serveSettings);
router.get('/admin/setting', isAuthenticated, hasRole(['admin']), serveSettings);

module.exports = router;
