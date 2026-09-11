const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Protect orders routes - Admin and Staff
router.use(isAuthenticated, hasRole(['admin', 'staff']));

const serveOrders = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/orders/orders.html'));
};

// GET /orders - Serve orders page
router.get('/orders', serveOrders);
router.get('/orders/', serveOrders);
router.get('/admin/orders', serveOrders);
router.get('/admin/orders/', serveOrders);

module.exports = router;
