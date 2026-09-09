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
    // Add item button
    document.getElementById('addItemBtn')?.addEventListener('click', () => InventoryCreate.openAddModal());

    // Search input
    InventoryDOM.searchInput?.addEventListener('input', (e) => {
      InventoryState.searchQuery = e.target.value;
      InventoryLoad.renderInventory();
    });

    document.getElementById('stockFilter')?.addEventListener('change', (e) => {
      InventoryState.stockFilter = e.target.value;
      InventoryLoad.renderInventory();
    });

    // Filter tabs
    InventoryDOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        InventoryDOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        InventoryState.currentFilter = tab.dataset.category;
        InventoryLoad.renderInventory();
      });
    });

    // Item form submit - Determine if create or update based on state
    InventoryDOM.itemForm?.addEventListener('submit', (e) => {
      if (InventoryState.editingItemId) {
        InventoryUpdate.handleUpdate(e);
      } else {
        InventoryCreate.handleCreate(e);
      }
    });

    // Multiple images upload
    document.getElementById('itemImages')?.addEventListener('change', (e) => InventoryImage.handleImagesSelect(e));

    // Modal close buttons
    document.getElementById('modalClose')?.addEventListener('click', () => InventoryCreate.closeModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => InventoryCreate.closeModal());

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => InventoryDelete.closeModal());

    // Delete Confirmation
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => InventoryDelete.handleDeleteConfirmed());

    // View modal buttons
    document.getElementById('viewEditBtn')?.addEventListener('click', () => {
      const id = InventoryState.viewingItemId;
      InventoryLoad.closeViewModal();
      if (id) InventoryUpdate.openEditModal(id);
    });
    document.getElementById('viewGenerateQrBtn')?.addEventListener('click', () => {
      if (InventoryState.viewingItemId) InventoryUpdate.generateQrForItem(InventoryState.viewingItemId);
    });
    document.getElementById('viewDeleteBtn')?.addEventListener('click', () => {
      const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
      InventoryLoad.closeViewModal();
      if (item) InventoryDelete.openDeleteModal(item.id, item.name);
    });
    document.getElementById('viewHistoryBtn')?.addEventListener('click', () => {
      if (InventoryState.viewingItemId) InventoryHistory.openHistoryModal(InventoryState.viewingItemId);
    });

    // Close modals on overlay click
    InventoryDOM.itemModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.itemModal) InventoryCreate.closeModal();
    });
    InventoryDOM.deleteModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.deleteModal) InventoryDelete.closeModal();
    });
    InventoryDOM.viewModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.viewModal) InventoryLoad.closeViewModal();
    });
    InventoryDOM.historyModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.historyModal) InventoryHistory.closeHistoryModal();
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Inventory.init());
