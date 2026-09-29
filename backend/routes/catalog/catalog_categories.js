const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../database/supabase');

router.get('/catalog/categories', async (_req, res) => {
    try {
        const { data, error } = await supabaseAdmin.rpc('inventory_category_get');
        if (error) {
            console.error('[Catalog Categories] RPC error:', error);
            return res.status(500).json({ success: false, error: 'Unable to load catalog categories' });
        }
        return res.json({ success: true, categories: data || [] });
    } catch {
        return res.status(500).json({ success: false, error: 'Unable to load catalog categories' });
    }
});

module.exports = router;
