const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// GET /settings - Serve settings page
router.get('/settings', isAuthenticated, hasRole(['admin']), (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/settings/settings.html'));
});

module.exports = router;
