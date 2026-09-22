const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/inventory/inventory_summaries', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.rpc('inventory_summaries');
        if (error) {
            console.error('inventory_summaries error:', error.message);
            return res.status(500).json({ success: false, error: 'Database error fetching inventory summaries.' });
        }
        res.json({ success: true, data });
    } catch (err) {
        console.error('inventory_summaries route error:', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

module.exports = router;
