const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Debug: Log when this router is being used
router.use((req, res, next) => {
    console.log(`[Orders Router] Matching path: ${req.path}, Original URL: ${req.originalUrl}, Method: ${req.method}`);
    next();
});

// Protect orders routes - Admin and Staff
router.use(isAuthenticated);
router.use(hasRole(['admin', 'staff']));

// GET /orders - Serve orders page (handle both with and without trailing slash)
router.get('/orders', (req, res) => {
    console.log(`[Orders Router] Serving /orders page`);
    res.sendFile(path.join(__dirname, '../../../public/orders/orders.html'));
});

router.get('/orders/', (req, res) => {
    console.log(`[Orders Router] Serving /orders/ page`);
    res.sendFile(path.join(__dirname, '../../../public/orders/orders.html'));
});

module.exports = router;
