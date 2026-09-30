const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/staff/settings', isAuthenticated, hasRole(['staff', 'admin']), (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/staff/setting/settings.html'));
});

module.exports = router;
