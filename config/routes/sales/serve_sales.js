const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../middleware/authMiddleware');

// Protect sales route - Admin and Staff
router.use(isAuthenticated, hasRole(['admin', 'staff']));

// GET /sales - Serve sales page
router.get('/sales', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/sales/sales.html'));
});

module.exports = router;