const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.delete('/inventory/categories/:slug', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
    const { error } = await supabaseAdmin.rpc('inventory_category_delete', {
        p_slug: slug,
        p_user_email: req.user?.username || req.user?.email || null
    });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
});

module.exports = router;
