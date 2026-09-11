const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../../database/supabase');

const dbClient = () => supabaseAdmin || supabase;

/**
 * GET /api/catalog/products
 * GET /api/inventory/list (alias for backward-compatibility)
 * Fetch public catalog items with category and search filtering
 * Calls RPC catalog_get_products with direct database query fallback
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

    // 1. Attempt catalog_get_products RPC
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('catalog_get_products', {
        filter_category: filterCategory,
        filter_search: filterSearch
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return res.json({ success: true, data: rpcData });
      }
    } catch (_) {}

    // 2. Attempt legacy inventory_get_all RPC fallback
    try {
      const { data: legacyData, error: legacyError } = await client.rpc('inventory_get_all', {
        filter_category: filterCategory,
        filter_search: filterSearch
      });

      if (!legacyError && Array.isArray(legacyData)) {
        // Strip sensitive fields (cost_price, total_profit) for public catalog
        const sanitized = legacyData.map(item => ({
          id: item.id,
          category: item.category,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          sale_price: item.sale_price,
          qr_image_url: item.qr_image_url,
          images: item.images,
          created_at: item.created_at,
          updated_at: item.updated_at
        }));
        return res.json({ success: true, data: sanitized });
      }
    } catch (_) {}

    // 3. Direct table query fallback
    let query = client
      .from('inventory')
      .select('id, category, name, description, quantity, sale_price, qr_image_url, images, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (filterCategory) {
      query = query.ilike('category', filterCategory);
    }

    if (filterSearch) {
      query = query.or(`name.ilike.%${filterSearch}%,description.ilike.%${filterSearch}%`);
    }

    const { data: directData, error: directError } = await query;

    if (directError) {
      console.error('[Catalog Get Products] Query error:', directError);
      return res.status(400).json({
        success: false,
        error: directError.message || 'Failed to fetch catalog items'
      });
    }

    return res.json({ success: true, data: directData || [] });
  } catch (err) {
    console.error('[Catalog Get Products] Exception:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
