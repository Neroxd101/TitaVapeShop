const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.post('/inventory/categories', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const { data, error } = await supabaseAdmin.rpc('inventory_category_create', {
        p_name: name,
        p_user_email: req.user?.username || req.user?.email || null
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, category: Array.isArray(data) ? data[0] : data });
});

module.exports = router;
