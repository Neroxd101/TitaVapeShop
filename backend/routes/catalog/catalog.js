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

// Public product catalog modal HTML - accessible without login
// GET /catalog/catalog-product-modal.html
router.get('/catalog/catalog-product-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-product-modal.html'));
});

// Public cart modal HTML
router.get('/catalog/catalog-cart-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-cart-modal.html'));
});

// Public privacy modal HTML
router.get('/catalog/catalog-privacy-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-privacy-modal.html'));
});

// Public checkout modal HTML
router.get('/catalog/catalog-checkout-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-checkout-modal.html'));
});

// Public order success modal HTML
router.get('/catalog/catalog-order-success-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-order-success-modal.html'));
});

// Public customer recent orders modal HTML
router.get('/catalog/catalog-orders-modal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/catalog/catalog-orders-modal.html'));
});

// Public customer auth modal HTML
router.get(['/customer/customer-auth-modal.html', '/catalog/customer-auth-modal.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../../../frontend/customer/customer-auth-modal.html'));
});

module.exports = router;
