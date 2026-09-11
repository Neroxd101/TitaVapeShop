const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Serve Staff Orders page - Staff and Admin
const serveStaffOrders = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../frontend/admin/staff/orders/orders.html'));
};

router.get('/staff/orders', isAuthenticated, hasRole(['staff', 'admin']), serveStaffOrders);
router.get('/staff/orders/', isAuthenticated, hasRole(['staff', 'admin']), serveStaffOrders);

module.exports = router;
