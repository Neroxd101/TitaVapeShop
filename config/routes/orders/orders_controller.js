const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect orders routes - Admin only
router.use(isAuthenticated, hasRole(['admin']));

// GET /orders - Serve orders page
router.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/orders/orders.html'));
});

module.exports = router;
