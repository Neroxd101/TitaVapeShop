// Keep the dashboard store profile synchronized with the Operating Hours settings.
async function dashboard_store_profile() {
  try {
    const response = await fetch('/api/catalog/store-hours');
    const result = await response.json();
    if (!response.ok || !result.success) return;

    const detailRows = document.querySelectorAll('.store-info-widget .store-detail-row');
    detailRows.forEach((row) => {
      const label = row.querySelector('.detail-label')?.textContent.trim();
      const value = row.querySelector('.detail-val');
      if (!value) return;

      if (label === 'Operating Hours') {
        value.textContent = `${result.data.label} Daily`;
      } else if (label === 'Location' && result.data.location_url) {
        value.textContent = result.data.location_url;
        value.title = result.data.location_url;
      }
    });
  } catch (error) {
    console.error('Unable to load store profile:', error);
  }
}



