const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect orders routes - Admin and Staff

const serveOrders = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/orders/orders.html'));
};

// GET /orders - Serve orders page
router.get('/orders', isAuthenticated, hasRole(['admin', 'staff']), serveOrders);
router.get('/admin/orders', isAuthenticated, hasRole(['admin', 'staff']), serveOrders);

module.exports = router;
