const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/inventory/inventory_delete_item/:id/preview', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Database not configured' });
        const { data, error } = await supabaseAdmin.rpc('inventory_delete_preview', { p_id: req.params.id });
        if (error) return res.status(400).json({ success: false, error: error.message });
        return res.status(data?.success ? 200 : 404).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Unable to preview deletion' });
    }
});

module.exports = router;
