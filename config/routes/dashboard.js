const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware');

// Protect dashboard route
// GET /dashboard - Serve dashboard page
router.get('/dashboard', isAuthenticated, hasRole(['admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard/dashboard.html'));
});

module.exports = router;
