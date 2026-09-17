const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Serve the shared POS page - Staff and Admin
const serveStaffPos = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/pos/pos.html'));
};

router.get('/staff/pos', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);
router.get('/staff/sales', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);
router.get('/staff', isAuthenticated, hasRole(['staff', 'admin']), serveStaffPos);

module.exports = router;
