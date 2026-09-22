const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// GET /pos/pos_get_products - Get active product list tailored for POS
router.get('/pos/pos_get_products', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database client not configured' });
        }

        const { data, error } = await supabaseAdmin.rpc('pos_get_products');

        if (error) {
            console.error('pos_get_products rpc error:', error.message);
            return res.status(400).json({ success: false, error: 'Failed to fetch POS products' });
        }

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('pos_get_products route error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
