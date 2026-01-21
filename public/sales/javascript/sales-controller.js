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

    await SalesCart.loadCartModal();
    wireEvents();
    // Header widgets (Google status + date/time)
    if (window.HeaderStatus && HeaderStatus.init) {
      HeaderStatus.init();
    }

    // Initialize Data
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
      searchInput.addEventListener('input', () => SalesLoad.filterProducts(state));
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => SalesLoad.filterProducts(state));
    }

    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', () => {
        state.cart = [];
        SalesCart.updateCartUI(state);
      });
    }

    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => SalesCreate.handleCompleteSale(e, state));
    }

    // Fallback if form not found but button is (though we expect the form now)
    if (!checkoutForm && completeSaleBtn) {
      completeSaleBtn.addEventListener('click', () => SalesCreate.handleCompleteSale(null, state)); // Pass null event 
    }

    // Update change display when cash input changes
    const cashInput = document.getElementById('cashInput');
    if (cashInput) {
      cashInput.addEventListener('input', () => SalesCart.updateChangeDisplay(state));
    }

    if (openCartModalBtn && cartModal) {
      openCartModalBtn.addEventListener('click', () => {
        cartModal.classList.add('show');
        SalesCart.updateCartUI(state);
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
        SalesQR.start(state);
      });
    }

    if (closeQrModalBtn && qrModal) {
      closeQrModalBtn.addEventListener('click', () => {
        qrModal.classList.remove('show');
        SalesQR.stop();
      });
    }

    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          qrModal.classList.remove('show');
          SalesQR.stop();
        }
      });
    }

    // Success modal
    const successModal = document.getElementById('successModal');
    const closeSuccessModalBtn = document.getElementById('closeSuccessModalBtn');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');

    if (closeSuccessModalBtn && successModal) {
      closeSuccessModalBtn.addEventListener('click', () => {
        successModal.classList.remove('show');
      });
    }

    if (closeSuccessBtn && successModal) {
      closeSuccessBtn.addEventListener('click', () => {
        successModal.classList.remove('show');
      });
    }

    if (successModal) {
      successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
          successModal.classList.remove('show');
        }
      });
    }

    // Confirmation Modal
    const confirmModal = document.getElementById('confirmModal');
    const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    const proceedSaleBtn = document.getElementById('proceedSaleBtn');

    if (closeConfirmModalBtn && confirmModal) {
      closeConfirmModalBtn.addEventListener('click', () => {
        confirmModal.classList.remove('show');
        window._pendingSale = null;
      });
    }

    if (cancelConfirmBtn && confirmModal) {
      cancelConfirmBtn.addEventListener('click', () => {
        confirmModal.classList.remove('show');
        window._pendingSale = null;
      });
    }

    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          confirmModal.classList.remove('show');
          window._pendingSale = null;
        }
      });
    }

    if (proceedSaleBtn) {
      proceedSaleBtn.addEventListener('click', () => {
        SalesCreate.proceedWithSale();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

