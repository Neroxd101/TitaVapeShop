const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect orders routes - Admin and Staff
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /orders - Serve orders page
router.get('/orders', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/orders/orders.html'));
});

// Handle trailing slash
router.get('/orders/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/orders/orders.html'));
});

module.exports = router;
