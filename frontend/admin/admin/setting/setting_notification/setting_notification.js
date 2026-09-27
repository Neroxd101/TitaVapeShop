window.settingNotification = {
    async load() {
        try {
            const response = await fetch('/api/settings/notifications');
            const result = await response.json();
            if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed to load notification settings');
            document.getElementById('lowStockNotificationsEnabled').checked = result.data.low_stock_notifications_enabled;
            document.getElementById('lowStockThreshold').value = result.data.low_stock_threshold;
            document.getElementById('lowStockEmail').value = result.data.low_stock_notification_email;
        } catch (error) { console.error('Error loading notification settings:', error); }
    },
    setup() {
        const form = document.getElementById('notificationSettingsForm');
        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = document.getElementById('saveNotificationSettingsBtn');
            window.settingsPage.setLoading(button, true);
            try {
                const response = await fetch('/api/settings/notifications', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        low_stock_threshold: Number.parseInt(document.getElementById('lowStockThreshold').value, 10),
                        low_stock_notifications_enabled: document.getElementById('lowStockNotificationsEnabled').checked,
                        low_stock_notification_email: document.getElementById('lowStockEmail').value.trim()
                    })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save notification settings');
                window.showSuccessModal('Success', 'Notification settings saved successfully!');
            } catch (error) { alert(error.message || 'Failed to save notification settings'); }
            finally { window.settingsPage.setLoading(button, false); }
        });
    }
};
