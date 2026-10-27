const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
router.post('/api/pos/void-sale', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const { sale_id, reason } = req.body || {};
    if (typeof sale_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sale_id)
        || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
        return res.status(400).json({ success: false, error: 'A valid sale and a reason of 1–1,000 characters are required.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Sale voiding is unavailable.' });
    try {
        const { data, error } = await supabaseAdmin.rpc('pos_void_sale', {
            p_sale_id: sale_id, p_reason: reason.trim(),
            p_user_email: req.user.username || req.user.email || req.user.id
        });
        if (error) return res.status(400).json({ success: false, error: error.message });
        return res.json(data);
    } catch (error) {
        console.error('[POS Void]', error);
        return res.status(500).json({ success: false, error: 'Unable to void sale.' });
    }
});
module.exports = router;
