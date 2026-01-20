const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// GET /transactions - Serve transactions page
router.get('/transactions', isAuthenticated, hasRole(['admin']), (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/transactions/transactions.html'));
});

module.exports = router;
