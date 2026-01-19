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

    // Render shared main header
    if (window.MainHeader && MainHeader.render) {
      MainHeader.render({ page: 'sales', title: 'Sales (POS)' });
    }

    await loadCartModal();
    wireEvents();
    // Header widgets (Google status + date/time)
    if (window.HeaderStatus && HeaderStatus.init) {
      HeaderStatus.init();
    }
    if (window.SalesProducts && SalesProducts.loadProducts) {
      SalesProducts.loadProducts(state, applyFilters);
    }
    if (window.SalesCart && SalesCart.updateCartUI) {
      SalesCart.updateCartUI(state, renderProducts);
    }
  }

  async function loadCartModal() {
    try {
      const response = await fetch('/sales/sales-cart-modal.html');
      if (!response.ok) {
        throw new Error(`Failed to load cart modal: ${response.statusText}`);
      }
      const html = await response.text();

      // Inject at end of body
      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const modalEl = temp.firstElementChild;
      if (modalEl) {
        document.body.appendChild(modalEl);
      }
    } catch (err) {
      console.error('Error loading cart modal:', err);
    }
  }

  function setupSidebar() {
    if (typeof initSidebar === 'function') {
      // Mark "Sales" as the active nav item
      initSidebar('sales');
    }
  }

  function wireEvents() {
    const searchInput = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('productCategoryFilter');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const completeSaleBtn = document.getElementById('completeSaleBtn');
    const openCartModalBtn = document.getElementById('openCartModalBtn');
    const closeCartModalBtn = document.getElementById('closeCartModalBtn');
    const cartModal = document.getElementById('cartModal');
    const openQrModalBtn = document.getElementById('openQrModalBtn');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrModal = document.getElementById('qrModal');

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', applyFilters);
    }

    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', () => {
        state.cart = [];
        if (window.SalesCart && SalesCart.updateCartUI) {
          SalesCart.updateCartUI(state, renderProducts);
        }
      });
    }

    if (completeSaleBtn && window.SalesCart && SalesCart.handleCompleteSale) {
      completeSaleBtn.addEventListener('click', () => SalesCart.handleCompleteSale(state, renderProducts));
    }

    // Update change display when cash input changes
    const cashInput = document.getElementById('cashInput');
    if (cashInput && window.SalesCart && SalesCart.updateChangeDisplay) {
      cashInput.addEventListener('input', () => SalesCart.updateChangeDisplay(state));
    }

    if (openCartModalBtn && cartModal) {
      openCartModalBtn.addEventListener('click', () => {
        cartModal.classList.add('show');
        if (window.SalesCart && SalesCart.updateCartUI) {
          SalesCart.updateCartUI(state, renderProducts);
        }
      });
    }

    if (closeCartModalBtn && cartModal) {
      closeCartModalBtn.addEventListener('click', () => {
        cartModal.classList.remove('show');
      });
    }

    if (cartModal) {
      cartModal.addEventListener('click', (e) => {
        if (e.target === cartModal) {
          cartModal.classList.remove('show');
        }
      });
    }

    if (openQrModalBtn && qrModal) {
      openQrModalBtn.addEventListener('click', () => {
        qrModal.classList.add('show');
        startQrScan();
      });
    }

    if (closeQrModalBtn && qrModal) {
      closeQrModalBtn.addEventListener('click', () => {
        qrModal.classList.remove('show');
        stopQrScan();
      });
    }

    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          qrModal.classList.remove('show');
          stopQrScan();
        }
      });
    }
  }

  async function startQrScan() {
    if (!window.SalesQrScanner || !SalesQrScanner.start) {
      alert('QR scanner is not available yet. Please refresh and try again.');
      return;
    }

    await SalesQrScanner.start({
      elementId: 'qrScanner',
      onDecoded: (decodedText) => {
        if (window.SalesQrFlow && SalesQrFlow.handleDecoded) {
          SalesQrFlow.handleDecoded(state, decodedText);
        }
      },
      onError: async (err) => {
        console.error('Error starting QR scanner:', err);
        alert('Unable to access camera for QR scanning.');
        await stopQrScan();
      },
    });
  }

  async function stopQrScan() {
    if (window.SalesQrScanner && SalesQrScanner.stop) {
      await SalesQrScanner.stop();
    }
  }

  function applyFilters() {
    const q = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const category = document.getElementById('productCategoryFilter')?.value || '';

    state.filtered = state.products.filter(item => {
      if (category && item.category !== category) return false;

      if (!q) return true;
      const haystack = `${item.name || ''} ${item.category || ''} ${item.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    if (window.SalesUI && SalesUI.renderProducts) {
      SalesUI.renderProducts(state);
    }
  }

  function renderProducts() {
    if (window.SalesUI && SalesUI.renderProducts) {
      SalesUI.renderProducts(state);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

