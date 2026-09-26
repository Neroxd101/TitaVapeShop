const express = require('express');
const router = express.Router();
const path = require('path');
const { supabaseAdmin, supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

const dbAdmin = () => supabaseAdmin || supabase;

// Serve settings page - Admin only
const serveSettings = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../frontend/admin/admin/setting/settings.html'));
};

router.get('/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/setting', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/setting', isAuthenticated, hasRole(['admin']), serveSettings);

// GET /api/settings/notifications - Fetch notification settings (Admin only)
router.get('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const client = dbAdmin();
        if (!client) {
            return res.status(500).json({ success: false, error: 'Database service unavailable' });
        }

        const { data, error } = await client
            .from('settings')
            .select('key, value');

        const result = {
            low_stock_threshold: 10,
            low_stock_notifications_enabled: true,
            low_stock_notification_email: process.env.SMTP_USER || 'vshoptita@gmail.com'
        };

        if (data && !error) {
            for (const s of data) {
                if (s.key === 'low_stock_threshold' && s.value !== null) {
                    result.low_stock_threshold = parseInt(s.value, 10) || 10;
                } else if (s.key === 'low_stock_notifications_enabled' && s.value !== null) {
                    result.low_stock_notifications_enabled = s.value === true || s.value === 'true';
                } else if (s.key === 'low_stock_notification_email' && s.value) {
                    result.low_stock_notification_email = String(s.value).trim();
                }
            }
        }

        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

// POST /api/settings/notifications - Save notification settings (Admin only)
router.post('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const client = dbAdmin();
        if (!client) {
            return res.status(500).json({ success: false, error: 'Database service unavailable' });
        }

        const { low_stock_threshold, low_stock_notifications_enabled, low_stock_notification_email } = req.body || {};

        if (low_stock_threshold === undefined || low_stock_notifications_enabled === undefined || !low_stock_notification_email) {
            return res.status(400).json({ success: false, error: 'Missing required configuration settings' });
        }

        const thresholdValue = parseInt(low_stock_threshold, 10);
        if (isNaN(thresholdValue) || thresholdValue < 1) {
            return res.status(400).json({ success: false, error: 'Threshold must be a positive number' });
        }

        const now = new Date().toISOString();
        const updates = [
            { key: 'low_stock_threshold', value: thresholdValue, updated_at: now },
            { key: 'low_stock_notifications_enabled', value: low_stock_notifications_enabled === true || low_stock_notifications_enabled === 'true', updated_at: now },
            { key: 'low_stock_notification_email', value: String(low_stock_notification_email).trim(), updated_at: now }
        ];

        const { error } = await client
            .from('settings')
            .upsert(updates);

        if (error) {
            console.error('[Settings Route] Bulk upsert error:', error.message);
            return res.status(500).json({ success: false, error: error.message || 'Failed to save settings' });
        }

        return res.json({ success: true, message: 'Notification settings updated successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

router.get('/api/settings/operating-hours', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const { data } = await dbAdmin().from('settings').select('key, value').in('key', ['operating_open_time', 'operating_close_time', 'store_location_url', 'store_facebook_url']);
    const values = Object.fromEntries((data || []).map(item => [item.key, item.value]));
    res.json({ success: true, data: { open_time: values.operating_open_time || '08:00', close_time: values.operating_close_time || '20:30', location_url: values.store_location_url || 'https://maps.app.goo.gl/GzssH9xZQUN94pU38', facebook_url: values.store_facebook_url || 'https://www.facebook.com/TitasVShopNaic' } });
});

router.post('/api/settings/operating-hours', isAuthenticated, hasRole(['admin']), async (req, res) => {
    const { open_time, close_time, location_url, facebook_url } = req.body || {};
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close_time) || !/^https?:\/\/\S+$/i.test(location_url) || !/^https?:\/\/\S+$/i.test(facebook_url)) return res.status(400).json({ success: false, error: 'Invalid operating hours or store links' });
    const { error } = await dbAdmin().from('settings').upsert([
        { key: 'operating_open_time', value: open_time, updated_at: new Date().toISOString() },
        { key: 'operating_close_time', value: close_time, updated_at: new Date().toISOString() }
        , { key: 'store_location_url', value: location_url, updated_at: new Date().toISOString() }
        , { key: 'store_facebook_url', value: facebook_url, updated_at: new Date().toISOString() }
    ]);
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

module.exports = router;
