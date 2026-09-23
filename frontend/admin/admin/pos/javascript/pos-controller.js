// Simple POS logic for the Sales page
(function () {
  const state = {
    products: [],
    filtered: [],
    cart: []
  };

  // QR scanner is handled by SalesQrScanner module.

  async function init() {
    // Ensure user is authenticated (reuses inventory utils)
    if (typeof InventoryUtils !== 'undefined') {
      InventoryUtils.checkAuth();
    }

    setupSidebar();

    await SalesCart.loadCartModal();
    await SalesCart.loadConfirmModal();
    await SalesCart.loadSuccessModal();
    wireEvents();

    // Initialize Data - ensure modules are loaded
    if (typeof SalesLoad === 'undefined') {
      console.error('SalesLoad module not loaded');
      return;
    }
    if (typeof SalesCart === 'undefined') {
      console.error('SalesCart module not loaded');
      return;
    }
    
    await SalesLoad.init(state);
    SalesCart.updateCartUI(state);
  }

  function setupSidebar() {
    if (typeof initSidebar === 'function') {
      // Mark "Sales" as the active nav item
      initSidebar('sales');
    }
  }

  function wireEvents() {
    const searchInput = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortBy = document.getElementById('sortBy');

    if (searchInput) {
      searchInput.addEventListener('input', () => SalesLoad.filterProducts(state));
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => SalesLoad.filterProducts(state));
    }

    if (sortBy) {
      sortBy.addEventListener('change', () => SalesLoad.filterProducts(state));
    }

    // Delegate modal and interaction events to their respective modules
    SalesQR.setupEventListeners?.(state);
    SalesCart.setupEventListeners?.(state);
    SalesCreate.setupEventListeners?.(state);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

