const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/api/settings/store-links', isAuthenticated, hasRole(['admin']), async (_req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { data, error } = await supabaseAdmin.rpc('setting_store_link', { p_action: 'get' });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to load store links' });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

router.post('/api/settings/store-links', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { location_url, facebook_url } = req.body || {};
        if (typeof location_url !== 'string' || typeof facebook_url !== 'string' || !/^https?:\/\/\S+$/i.test(location_url) || !/^https?:\/\/\S+$/i.test(facebook_url)) {
            return res.status(400).json({ success: false, error: 'Invalid store links' });
        }
        const { data, error } = await supabaseAdmin.rpc('setting_store_link', {
            p_action: 'update', p_location_url: location_url.trim(), p_facebook_url: facebook_url.trim()
        });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to save store links' });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
