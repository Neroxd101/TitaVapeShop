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
    document.getElementById('printStocksBtn')?.addEventListener('click', () => InventoryPrint.print());
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
        InventoryLoad.viewItem(card.dataset.id);
      }
    });

    document.getElementById('editThumbnails')?.addEventListener('click', (e) => {
      const imageItem = e.target.closest('.image-item');
      if (!imageItem) return;
      const index = Number(imageItem.dataset.index);
      if (e.target.closest('.remove-image')) InventoryImage.removeImage(index);
      else InventoryImage.setEditMainImage(index);
    });

    document.getElementById('viewThumbnails')?.addEventListener('click', (e) => {
      const thumbnail = e.target.closest('.view-thumbnail');
      if (!thumbnail) return;
      const index = Number(thumbnail.dataset.imageIndex);
      const item = InventoryState.inventoryItems.find(i => i.id === InventoryState.viewingItemId);
      const images = item ? InventoryImage.parseImages(item) : [];
      if (item?.qr_image_url && !images.includes(item.qr_image_url)) images.push(item.qr_image_url);
      if (images[index]) InventoryLoad.setViewMainImage(images[index], index);
    });

    document.addEventListener('error', (e) => {
      const image = e.target;
      if (!(image instanceof HTMLImageElement) || !image.dataset.originalUrl) return;
      InventoryImage.handleImageError(image, image.dataset.originalUrl, Number(image.dataset.fallbackSize) || 800);
    }, true);

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
