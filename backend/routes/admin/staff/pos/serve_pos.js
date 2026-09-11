const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Serve Staff POS page - Staff and Admin
const serveStaffPos = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../frontend/admin/staff/pos/pos.html'));
};

router.get('/staff/pos', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);
router.get('/staff/sales', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);
router.get('/staff', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);

module.exports = router;
