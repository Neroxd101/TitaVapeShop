const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/catalog/products
 * GET /api/inventory/list (alias for backward-compatibility)
 * Fetch public catalog items with category and search filtering
 * Exclusively calls RPC catalog_get_products (returns public fields only)
 */
router.get(['/api/catalog/products', '/api/inventory/list'], async (req, res) => {
  try {
    const client = dbClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Database service unavailable' });
    }

    const { category, search } = req.query;
    const filterCategory = (category && category !== 'all') ? category.trim() : null;
    const filterSearch = search ? search.trim() : null;

    const { data, error } = await client.rpc('catalog_get_products', {
      filter_category: filterCategory,
      filter_search: filterSearch
    });

    if (error) {
      console.error('[Catalog Get Products] RPC error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch catalog items'
      });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[Catalog Get Products] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
