// Main inventory initialization namespace
// State, DOM Elements, and Utils are now in inventory-shared.js

const Inventory = {
  // Initialize
  async init() {
    const user = InventoryUtils.checkAuth();
    if (!user) return;

    // Initialize DOM references
    InventoryDOM.init();
    InventoryImage.init();

    // Initialize sidebar first
    await initSidebar('inventory');

    // Initialize Feature Modules
    await Promise.all([
      InventoryDisplay.init(),
      InventoryCreate.init(),
      InventoryDelete.init(),
      InventoryHistory.init()
      // InventoryUpdate doesn't need explicit init as it shares the Create modal
    ]);

    await InventoryCategories.init();
    InventorySearch.init();
    InventoryFilter.init();
    InventoryPagination.init();
    InventoryPrintDropdown.init();
    InventoryProductCard.init();

    // Check if we should open add modal (from dashboard quick action)
    if (sessionStorage.getItem('openAddItemModal') === 'true') {
      sessionStorage.removeItem('openAddItemModal');
      // Small delay to ensure modal is ready
      setTimeout(() => {
        InventoryCreate.openAddModal();
      }, 300);
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Inventory.init());
