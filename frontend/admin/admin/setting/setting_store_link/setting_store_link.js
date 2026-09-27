window.settingStoreLink = {
    async load() {
        try {
            const response = await fetch('/api/settings/store-links');
            const result = await response.json();
            if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Failed to load store links');
            document.getElementById('storeLocationUrl').value = result.data.location_url;
            document.getElementById('storeFacebookUrl').value = result.data.facebook_url;
        } catch (error) { console.error('Error loading store links:', error); }
    },
    setup() {
        document.getElementById('storeLinksForm')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = document.getElementById('saveStoreLinksBtn');
            window.settingsPage.setLoading(button, true);
            try {
                const response = await fetch('/api/settings/store-links', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        location_url: document.getElementById('storeLocationUrl').value.trim(),
                        facebook_url: document.getElementById('storeFacebookUrl').value.trim()
                    })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save store links');
                window.showSuccessModal('Success', 'Store links saved successfully!');
            } catch (error) { alert(error.message); }
            finally { window.settingsPage.setLoading(button, false); }
        });
    }
};
