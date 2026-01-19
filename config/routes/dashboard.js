const express = require('express');
const path = require('path');
const router = express.Router();

// GET /dashboard - Serve dashboard page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/dashboard/dashboard.html'));
});

module.exports = router;
