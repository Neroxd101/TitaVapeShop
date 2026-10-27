const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');
router.get('/api/pos/sales-history', isAuthenticated, hasRole(['admin', 'staff']), async (req, res) => {
    const { offset = '0', search = '', start_date, end_date } = req.query;
    if (typeof offset !== 'string' || !/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))
        || typeof search !== 'string' || search.length > 200
        || [start_date, end_date].some(value => value !== undefined && (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))))) {
        return res.status(400).json({ success: false, error: 'Invalid history filters.' });
    }
    if (start_date && end_date && Date.parse(start_date) >= Date.parse(end_date)) {
        return res.status(400).json({ success: false, error: 'End date must follow start date.' });
    }
    if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Sales history is unavailable.' });
    try {
        const { data, error } = await supabaseAdmin.rpc('pos_sales_history', {
            p_limit: 20, p_offset: Number(offset), p_search: search.trim() || null,
            p_start_date: start_date || null, p_end_date: end_date || null
        });
        if (error) return res.status(400).json({ success: false, error: error.message });
        res.set('Cache-Control', 'private, no-store');
        const roles = (Array.isArray(req.user?.roles) ? req.user.roles : String(req.user?.roles || '').split(','))
            .map(role => String(role).trim().toLowerCase());
        return res.json({ success: true, ...data, canVoid: roles.includes('admin') });
    } catch (error) {
        console.error('[POS History]', error);
        return res.status(500).json({ success: false, error: 'Unable to load sales history.' });
    }
});
module.exports = router;
