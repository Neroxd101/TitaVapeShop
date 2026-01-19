// Main inventory initialization namespace
const Inventory = {
  // Initialize
  async init() {
    const user = InventoryUtils.checkAuth();
    if (!user) return;
    
    // Initialize DOM references
    InventoryDOM.init();
    
    // Initialize sidebar first
    await initSidebar('inventory');
    
    // Load modals
    await Promise.all([
      InventoryModal.loadItemModal(),
      InventoryModal.loadViewModal(),
      InventoryModal.loadDeleteModal()
    ]);
    
    // User info is now set by sidebar.js
    
    // Load inventory
    InventoryAPI.loadInventory();
    
    // Setup event listeners
    this.setupEventListeners();
  },

  // Setup event listeners
  setupEventListeners() {
    // Logout and menu toggle are now handled by sidebar.js
    
    // Add item button
    document.getElementById('addItemBtn')?.addEventListener('click', () => InventoryModal.openAddModal());
    
    // Search input
    InventoryDOM.searchInput?.addEventListener('input', (e) => {
      InventoryState.searchQuery = e.target.value;
      InventoryCard.renderInventory();
    });
    
    // Filter tabs
    InventoryDOM.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        InventoryDOM.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        InventoryState.currentFilter = tab.dataset.category;
        InventoryCard.renderInventory();
      });
    });
    
    // Item form submit (API Route: POST /inventory/api | PUT /inventory/api)
    InventoryDOM.itemForm?.addEventListener('submit', (e) => InventoryAPI.saveItem(e));
    
    // Multiple images upload
    document.getElementById('itemImages')?.addEventListener('change', (e) => InventoryImage.handleImagesSelect(e));
    
    // Modal close buttons
    document.getElementById('modalClose')?.addEventListener('click', () => InventoryModal.closeItemModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => InventoryModal.closeItemModal());
    document.getElementById('deleteModalClose')?.addEventListener('click', () => InventoryModal.closeDeleteModal());
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => InventoryModal.closeDeleteModal());
    
    // Delete button (API Route: DELETE /inventory/api/:id)
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => InventoryAPI.confirmDelete());
    
    // View modal buttons
    document.getElementById('viewEditBtn')?.addEventListener('click', () => {
      const id = InventoryState.viewingItemId;
      InventoryModal.closeViewModal(false); // keep id so edit can use it
      if (id) InventoryModal.editItem(id);
    });
    document.getElementById('viewGenerateQrBtn')?.addEventListener('click', () => {
      if (InventoryState.viewingItemId) InventoryAPI.generateQrForItem(InventoryState.viewingItemId);
    });
    document.getElementById('viewDeleteBtn')?.addEventListener('click', () => {
      const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
      InventoryModal.closeViewModal();
      if (item) InventoryModal.deleteItem(item.id, item.name);
    });
    
    // Close modals on overlay click
    InventoryDOM.itemModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.itemModal) InventoryModal.closeItemModal();
    });
    InventoryDOM.deleteModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.deleteModal) InventoryModal.closeDeleteModal();
    });
    InventoryDOM.viewModal?.addEventListener('click', (e) => {
      if (e.target === InventoryDOM.viewModal) InventoryModal.closeViewModal();
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Inventory.init());
