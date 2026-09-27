const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/api/settings/operating-hours', isAuthenticated, hasRole(['admin']), async (_req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { data, error } = await supabaseAdmin.rpc('setting_operating_hours', { p_action: 'get' });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to load operating hours' });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

router.post('/api/settings/operating-hours', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { open_time, close_time } = req.body || {};
        if (typeof open_time !== 'string' || typeof close_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(open_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close_time)) {
            return res.status(400).json({ success: false, error: 'Invalid operating hours' });
        }
        const { data, error } = await supabaseAdmin.rpc('setting_operating_hours', {
            p_action: 'update', p_open_time: open_time, p_close_time: close_time
        });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to save operating hours' });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
