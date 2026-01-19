const express = require('express');
const path = require('path');

const router = express.Router();

/**
 * 📋 SALES (POS) ROUTES
 *
 * Notes:
 * - This page is the POS frontend that works on top of inventory items.
 * - It currently loads inventory via `/inventory/load-items`.
 * - Backend persistence for completed sales can be wired later (e.g. Supabase Edge Function).
 */

// GET /sales or /sales/new - Serve sales (POS) page
router.get(['/', '/new'], (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/sales/sales.html'));
});

module.exports = router;

