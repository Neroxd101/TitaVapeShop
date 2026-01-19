// Product loading helpers for Sales (POS)
// Exposed globally as SalesProducts (no module bundler required).

(function () {
  async function loadProducts(state, onAfterLoad) {
    if (!state) return;

    try {
      const response = await fetch('/inventory/load-items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        }
      });

      const result = await response.json();

      if (result.success) {
        state.products = (result.data || []).filter(p => !p.deleted);
      } else {
        console.error('Failed to load inventory for POS:', result.error);
        state.products = [];
      }
    } catch (err) {
      console.error('Error loading inventory for POS:', err);
      state.products = [];
    }

    if (typeof onAfterLoad === 'function') {
      onAfterLoad();
    }
  }

  window.SalesProducts = { loadProducts };
})();

