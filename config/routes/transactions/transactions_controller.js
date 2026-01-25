const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect transactions route
// GET /transactions - Serve transactions page
router.get('/transactions', isAuthenticated, hasRole(['admin']), (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/transactions/transactions.html'));
});

module.exports = router;
