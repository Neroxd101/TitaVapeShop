/**
 * Load public store hours and links into the catalog header and footer.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/catalog/store-hours');
        const result = await response.json();
        if (!result.success) return;

        const { label, location_url, facebook_url } = result.data;
        const hours = document.getElementById('catalogOperatingHours');
        if (hours) hours.textContent = label;

        ['catalogLocationLink', 'catalogFooterLocationLink'].forEach(id => {
            const link = document.getElementById(id);
            if (link) link.href = location_url;
        });

        ['catalogFacebookLink', 'catalogFooterFacebookLink'].forEach(id => {
            const link = document.getElementById(id);
            if (link) link.href = facebook_url;
        });
    } catch {
        // Keep the default hours and links from the HTML if loading fails.
    }
});
