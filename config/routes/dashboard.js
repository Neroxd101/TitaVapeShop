const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');

// Protect dashboard route
router.use(isAuthenticated);

// GET /dashboard - Serve dashboard page
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard/dashboard.html'));
});

module.exports = router;
