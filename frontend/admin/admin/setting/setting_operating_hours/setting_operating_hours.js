window.settingOperatingHours = {
    async load() {
        try {
            const response = await fetch('/api/settings/operating-hours');
            const result = await response.json();
            if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed to load operating hours');
            document.getElementById('operatingOpenTime').value = result.data.open_time;
            document.getElementById('operatingCloseTime').value = result.data.close_time;
        } catch (error) { console.error('Error loading operating hours:', error); }
    },
    setup() {
        document.getElementById('operatingHoursForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = document.getElementById('saveOperatingHoursBtn');
            window.settingsPage.setLoading(button, true);
            try {
                const response = await fetch('/api/settings/operating-hours', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        open_time: document.getElementById('operatingOpenTime').value,
                        close_time: document.getElementById('operatingCloseTime').value
                    })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save operating hours');
                window.showSuccessModal('Success', 'Operating hours saved successfully!');
            } catch (error) { alert(error.message); }
            finally { window.settingsPage.setLoading(button, false); }
        });
    }
};
