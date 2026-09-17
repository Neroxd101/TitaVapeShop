const express = require('express');
const path = require('path');
const router = express.Router();

// =============================================
// PUBLIC ROUTES - No authentication required
// These routes are accessible to anyone (customers)
// =============================================

// Public product catalog page - accessible without login
// GET /catalog
router.get(['/', '/catalog'], (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog.html'));
});

// Public order status tracking page
// GET /order-status
router.get('/order-status', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/order-status/order-status.html'));
});

// Public customer auth modal HTML
router.get('/catalog/customer-auth-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/customer/customer-auth-modal.html'));
});

module.exports = router;
