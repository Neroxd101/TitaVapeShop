// Main inventory initialization namespace
// Includes State, DOM Elements, and Utils

// State management
const InventoryState = {
  inventoryItems: [],
  currentFilter: 'all',
  searchQuery: '',
  editingItemId: null,
  deletingItemId: null,
  currentImages: [], // Array of { url, file, uploading }
  viewingItemId: null,
  MAX_IMAGES: 5
};

// DOM Elements
const InventoryDOM = {
  // Static elements
  inventoryGrid: null,
  emptyState: null,
  loadingState: null,
  searchInput: null,
  filterTabs: null,

  // Modal references (will be set after modals are loaded)
  itemModal: null,
  viewModal: null,
  deleteModal: null,
  itemForm: null,

  // Initialize DOM references
  init() {
    this.inventoryGrid = document.getElementById('inventoryGrid');
    this.emptyState = document.getElementById('emptyState');
    this.loadingState = document.getElementById('loadingState');
    this.searchInput = document.getElementById('searchInput');
    this.filterTabs = document.querySelectorAll('.filter-tab');
  }
};

// Utility functions
const InventoryUtils = {
  // Check authentication (Local check for UI purposes)
  checkAuth() {
    const user = localStorage.getItem('user');

    if (!user) {
      window.location.href = '/';
      return null;
    }

    return JSON.parse(user);
  },

  // Format currency
  formatCurrency(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // Format date with time
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Google Auth Helpers
  isGoogleConnected() {
    return localStorage.getItem('google_connected') === 'true';
  },

  getGoogleToken() {
    return localStorage.getItem('google_access_token');
  }
};

const Inventory = {
  // Initialize
  async init() {
    const user = InventoryUtils.checkAuth();
    if (!user) return;

    // Initialize DOM references
    InventoryDOM.init();

    // Initialize sidebar first
    await initSidebar('inventory');

    // Render shared main header
    if (window.MainHeader && MainHeader.render) {
      MainHeader.render({ page: 'inventory', title: 'Inventory' });
    }

    // Initialize Feature Modules
    await Promise.all([
      InventoryLoad.init(),
      InventoryCreate.init(),
      InventoryDelete.init()
      // InventoryUpdate doesn't need explicit init as it shares the Create modal
    ]);

    // User info is now set by sidebar.js
    // Header widgets
    if (window.HeaderStatus && HeaderStatus.init) {
      HeaderStatus.init();
    }

    // Setup event listeners
    this.setupEventListeners();
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

    document.getElementById('deleteModalClose')?.addEventListener('click', () => InventoryDelete.closeModal());
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
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Inventory.init());
