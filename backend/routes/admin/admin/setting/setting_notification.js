const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (_req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { data, error } = await supabaseAdmin.rpc('setting_notification', { p_action: 'get' });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to load notification settings' });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

router.post('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ success: false, error: 'Database service unavailable' });
        const { low_stock_threshold, low_stock_notifications_enabled, low_stock_notification_email } = req.body || {};
        const threshold = Number.parseInt(low_stock_threshold, 10);
        const email = typeof low_stock_notification_email === 'string' ? low_stock_notification_email.trim() : '';
        if (!Number.isInteger(threshold) || threshold < 1 || low_stock_notifications_enabled === undefined || !email) {
            return res.status(400).json({ success: false, error: 'Invalid notification settings' });
        }
        const { data, error } = await supabaseAdmin.rpc('setting_notification', {
            p_action: 'update',
            p_low_stock_threshold: threshold,
            p_low_stock_notifications_enabled: low_stock_notifications_enabled === true || low_stock_notifications_enabled === 'true',
            p_low_stock_notification_email: email
        });
        if (error) return res.status(500).json({ success: false, error: error.message || 'Failed to save notification settings' });
        return res.json({ success: true, data, message: 'Notification settings updated successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
