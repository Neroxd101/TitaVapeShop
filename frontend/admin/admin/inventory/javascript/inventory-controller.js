// Main inventory initialization namespace
// State, DOM Elements, and Utils are now in inventory-shared.js

const Inventory = {
  // Initialize
  async init() {
    const user = InventoryUtils.checkAuth();
    if (!user) return;

    // Initialize DOM references
    InventoryDOM.init();

    // Initialize sidebar first
    await initSidebar('inventory');

    // Initialize Feature Modules
    await Promise.all([
      InventoryLoad.init(),
      InventoryCreate.init(),
      InventoryDelete.init(),
      InventoryHistory.init()
      // InventoryUpdate doesn't need explicit init as it shares the Create modal
    ]);

    await InventoryCategories.init();

    // Setup event listeners
    this.setupEventListeners();

    // Check if we should open add modal (from dashboard quick action)
    if (sessionStorage.getItem('openAddItemModal') === 'true') {
      sessionStorage.removeItem('openAddItemModal');
      // Small delay to ensure modal is ready
      setTimeout(() => {
        InventoryCreate.openAddModal();
      }, 300);
    }
  },

  // Setup event listeners
  setupEventListeners() {
    document.getElementById('printStocksBtn')?.addEventListener('click', () => InventoryPrint.print());
    // Add item button
    document.getElementById('addItemBtn')?.addEventListener('click', () => InventoryCreate.openAddModal());

    // Search input
    InventoryDOM.searchInput?.addEventListener('input', (e) => {
      InventoryState.searchQuery = e.target.value;
      InventoryState.currentPage = 1;
      InventoryLoad.renderInventory();
    });

    InventoryDOM.sortBySelect?.addEventListener('change', (e) => {
      InventoryState.sortBy = e.target.value;
      InventoryState.currentPage = 1;
      InventoryLoad.renderInventory();
    });

    // Date added filter
    const addedDateFrom = document.getElementById('addedDateFrom');
    const addedDateTo = document.getElementById('addedDateTo');
    const clearAddedDateBtn = document.getElementById('clearAddedDateBtn');
    const syncDatePlaceholders = () => {
      [addedDateFrom, addedDateTo].forEach(input => {
        input?.parentElement.classList.toggle('is-empty', !input.value);
      });
    };
    syncDatePlaceholders();
    addedDateFrom?.addEventListener('input', syncDatePlaceholders);
    addedDateTo?.addEventListener('input', syncDatePlaceholders);
    const updateAddedDates = () => {
      syncDatePlaceholders();
      addedDateFrom.max = addedDateTo.value;
      addedDateTo.min = addedDateFrom.value;
      clearAddedDateBtn.disabled = !addedDateFrom.value && !addedDateTo.value;
      if (!addedDateFrom.reportValidity() || !addedDateTo.reportValidity()) return;
      InventoryState.addedDateFrom = addedDateFrom.value;
      InventoryState.addedDateTo = addedDateTo.value;
      InventoryState.currentPage = 1;
      InventoryLoad.renderInventory();
    };
    addedDateFrom?.addEventListener('change', updateAddedDates);
    addedDateTo?.addEventListener('change', updateAddedDates);
    clearAddedDateBtn?.addEventListener('click', () => {
      addedDateFrom.value = '';
      addedDateTo.value = '';
      updateAddedDates();
      addedDateFrom.focus();
    });

    // Category filter dropdown
    InventoryDOM.categoryFilter?.addEventListener('change', (e) => {
      InventoryState.currentFilter = e.target.value;
      InventoryState.currentPage = 1;
      InventoryLoad.renderInventory();
    });

    // Pagination controls
    InventoryDOM.prevPageBtn?.addEventListener('click', () => {
      InventoryLoad.goToPage(InventoryState.currentPage - 1);
    });

    InventoryDOM.nextPageBtn?.addEventListener('click', () => {
      InventoryLoad.goToPage(InventoryState.currentPage + 1);
    });

    InventoryDOM.pageSizeSelect?.addEventListener('change', (e) => {
      InventoryLoad.setPageSize(e.target.value);
    });

    // Dynamic inventory content uses delegated events so it remains compatible
    // with the Content Security Policy (inline event handlers are blocked).
    InventoryDOM.inventoryGrid?.addEventListener('click', (e) => {
      const card = e.target.closest('.inventory-card');
      if (!card) return;

      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'edit') {
        InventoryUpdate.openEditModal(card.dataset.id);
      } else if (action === 'delete') {
        const item = InventoryState.inventoryItems.find(i => i.id === card.dataset.id);
        if (item) InventoryDelete.openDeleteModal(item.id, item.name);
      } else {
        if (window.InventoryViewModal?.viewItem) {
          InventoryViewModal.viewItem(card.dataset.id);
        } else {
          InventoryLoad.viewItem(card.dataset.id);
        }
      }
    });

    // Image fallback error listener
    document.addEventListener('error', (e) => {
      const image = e.target;
      if (!(image instanceof HTMLImageElement) || !image.dataset.originalUrl) return;
      InventoryImage.handleImageError(image, image.dataset.originalUrl, Number(image.dataset.fallbackSize) || 800);
    }, true);
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Inventory.init());
