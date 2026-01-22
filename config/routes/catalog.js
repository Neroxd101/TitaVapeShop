const express = require('express');
const path = require('path');
const router = express.Router();
const { supabase } = require('../database/supabase');

// Public product catalog page
// GET /catalog
router.get('/catalog', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/catalog/catalog.html'));
});

// Public inventory list for catalog
// GET /api/inventory/list
router.get('/api/inventory/list', async (req, res) => {
  try {
    if (!supabase) {
      return res
        .status(500)
        .json({ success: false, error: 'Database not configured' });
    }

    const { category, search } = req.query;

    // Call database RPC function directly
    // All filtering and sorting is done in the database
    const { data, error } = await supabase.rpc('inventory_get_all', {
      filter_category: category || null,
      filter_search: search || null
    });

    if (error) {
      console.error('RPC Error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch catalog items'
      });
    }

    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Catalog inventory fetch error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

