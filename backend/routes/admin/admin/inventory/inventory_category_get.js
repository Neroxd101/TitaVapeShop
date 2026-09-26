const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/inventory/categories', isAuthenticated, hasRole(['admin', 'staff']), async (_req, res) => {
    const { data, error } = await supabaseAdmin.rpc('inventory_category_get');
    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, categories: data || [] });
});

module.exports = router;
