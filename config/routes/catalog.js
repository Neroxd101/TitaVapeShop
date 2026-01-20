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

    const { data, error } = await supabase.functions.invoke('inventory', {
      body: {
        action: 'list',
        category: req.query.category,
        search: req.query.search,
      },
    });

    if (error) {
      console.error('Supabase function error (catalog):', error);
      if (data && typeof data === 'object') {
        return res.status(400).json(data);
      }
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch catalog items',
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Catalog inventory fetch error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

