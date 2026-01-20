const express = require('express');
const path = require('path');
const router = express.Router();

// GET /sales - Serve sales page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/sales/sales.html'));
});

module.exports = router;