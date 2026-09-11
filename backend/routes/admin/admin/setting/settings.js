const express = require('express');
const router = express.Router();
const path = require('path');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

// Serve settings page - Admin only
const serveSettings = (req, res) => {
    res.sendFile(path.join(__dirname, '../../../../../public/admin/admin/setting/settings.html'));
};

router.get('/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/settings', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/setting', isAuthenticated, hasRole(['admin']), serveSettings);
router.get('/admin/setting', isAuthenticated, hasRole(['admin']), serveSettings);

// GET /api/settings/notifications - Fetch notification settings (Admin only)
router.get('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const { supabaseAdmin } = require('../../../../database/supabase');
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
        }

        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('key, value');

        if (error) {
            // If the table doesn't exist yet, return the default values gracefully
            console.warn('[Settings Route] Could not read settings table, using defaults:', error.message);
            return res.json({
                success: true,
                data: {
                    low_stock_threshold: 10,
                    low_stock_notifications_enabled: true,
                    low_stock_notification_email: process.env.SMTP_USER || 'vshoptita@gmail.com'
                }
            });
        }

        const result = {
            low_stock_threshold: 10,
            low_stock_notifications_enabled: true,
            low_stock_notification_email: process.env.SMTP_USER || 'vshoptita@gmail.com'
        };

        if (data) {
            const thresholdSetting = data.find(s => s.key === 'low_stock_threshold');
            const enabledSetting = data.find(s => s.key === 'low_stock_notifications_enabled');
            const emailSetting = data.find(s => s.key === 'low_stock_notification_email');

            if (thresholdSetting && thresholdSetting.value !== null) {
                result.low_stock_threshold = parseInt(thresholdSetting.value, 10);
            }
            if (enabledSetting && enabledSetting.value !== null) {
                result.low_stock_notifications_enabled = enabledSetting.value === true || enabledSetting.value === 'true';
            }
            if (emailSetting && emailSetting.value !== null && emailSetting.value !== '') {
                result.low_stock_notification_email = emailSetting.value;
            }
        }

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

// POST /api/settings/notifications - Save notification settings (Admin only)
router.post('/api/settings/notifications', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        const { supabaseAdmin } = require('../../../../database/supabase');
        if (!supabaseAdmin) {
            return res.status(500).json({ success: false, error: 'Database admin connection not configured' });
        }

        const { low_stock_threshold, low_stock_notifications_enabled, low_stock_notification_email } = req.body;

        if (low_stock_threshold === undefined || low_stock_notifications_enabled === undefined || !low_stock_notification_email) {
            return res.status(400).json({ success: false, error: 'Missing required configuration settings' });
        }

        const thresholdValue = parseInt(low_stock_threshold, 10);
        if (isNaN(thresholdValue) || thresholdValue < 1) {
            return res.status(400).json({ success: false, error: 'Threshold must be a positive number' });
        }

        // Upsert key-value pairs
        const updates = [
            { key: 'low_stock_threshold', value: thresholdValue },
            { key: 'low_stock_notifications_enabled', value: low_stock_notifications_enabled === true || low_stock_notifications_enabled === 'true' },
            { key: 'low_stock_notification_email', value: String(low_stock_notification_email).trim() }
        ];

        for (const item of updates) {
            const { error } = await supabaseAdmin
                .from('settings')
                .upsert({ key: item.key, value: item.value, updated_at: new Date().toISOString() });

            if (error) {
                console.error(`[Settings Route] Error saving setting ${item.key}:`, error.message);
                return res.status(500).json({ success: false, error: `Failed to save setting: ${item.key}` });
            }
        }

        res.json({ success: true, message: 'Notification settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
});

module.exports = router;
