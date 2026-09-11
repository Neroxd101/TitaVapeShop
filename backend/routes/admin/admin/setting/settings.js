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

module.exports = router;
