const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * GET /forgot-password - Serve admin/staff forgot password page
 */
const serveForgotPassword = (req, res) => {
  res.sendFile(path.join(__dirname, '../../../../frontend/admin/login/forgot-password.html'));
};

router.get('/forgot-password', serveForgotPassword);
router.get('/admin/login/forgot-password', serveForgotPassword);
router.get('/admin/forgot-password', serveForgotPassword);

module.exports = router;
