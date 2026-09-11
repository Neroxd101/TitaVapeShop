const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Serve POS page - Admin & Staff
const servePos = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../public/admin/admin/pos/pos.html'));
};

router.get('/pos', isAuthenticated, hasRole(['admin', 'staff']), servePos);
router.get('/sales', isAuthenticated, hasRole(['admin', 'staff']), servePos);
router.get('/admin/pos', isAuthenticated, hasRole(['admin']), servePos);
router.get('/admin/sales', isAuthenticated, hasRole(['admin']), servePos);

module.exports = router;
