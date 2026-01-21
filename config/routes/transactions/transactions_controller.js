const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated } = require('../../middleware/authMiddleware');

// Protect transactions route
router.use(isAuthenticated);

// GET /transactions - Serve transactions page
router.get('/transactions', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/transactions/transactions.html'));
});

module.exports = router;
